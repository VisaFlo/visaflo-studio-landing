import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { startRecording, STOP_TIMEOUT_MS, type ActiveRecorder } from "@/lib/studio/recorder"

// Just enough MediaRecorder to drive startRecording: data and stop events are
// fired by the test (synchronously; the winding-down test plays the browser's
// real inactive → data → stop order by hand).
class FakeRecorder {
  static instances: FakeRecorder[] = []
  static isTypeSupported = () => true
  // Like the real one: inactive until start() is called.
  state: "recording" | "inactive" = "inactive"
  timeslice: number | undefined
  mimeType = "video/webm"
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: ((event: Event) => void) | null = null
  onerror: ((event: { error?: unknown }) => void) | null = null
  constructor() {
    FakeRecorder.instances.push(this)
  }
  start(timeslice?: number) {
    this.state = "recording"
    this.timeslice = timeslice
  }
  stop() {
    this.state = "inactive"
    this.onstop?.(new Event("stop"))
  }
  // An encoder failure: error, then stop.
  die(error: unknown) {
    this.onerror?.({ error })
    this.stop()
  }
  chunk(bytes = 1) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) })
  }
}

// A recorder whose stop event never comes (a browser bug).
class StuckRecorder extends FakeRecorder {
  stop() {
    this.state = "inactive"
  }
}

// A browser that can't record this stream at all.
class RefusingRecorder extends FakeRecorder {
  start() {
    throw new DOMException("can't record this stream", "NotSupportedError")
  }
}

// An AudioContext whose analyser always reads the same signal level. Tests
// flip `state` on the instances to play an autoplay block or a phone call.
const fakeAudio = (rms: number, state: "running" | "suspended" = "running") =>
  class FakeAudio {
    static instances: FakeAudio[] = []
    static reads = 0
    static closes = 0
    state: "running" | "suspended" = state
    constructor() {
      FakeAudio.instances.push(this)
    }
    resume = async () => {}
    close = async () => {
      FakeAudio.closes += 1
    }
    createAnalyser = () => ({
      fftSize: 1024,
      getFloatTimeDomainData: (samples: Float32Array) => {
        FakeAudio.reads += 1
        samples.fill(rms)
      },
    })
    createMediaStreamSource = () => ({ connect() {} })
  }

const noAudio = class {
  constructor() {
    throw new Error("no Web Audio")
  }
}

type Options = { onEnded?: (reason: "error" | "ended") => void; onChunk?: (chunk: Blob, index: number) => void; Recorder?: typeof FakeRecorder }

function setup(Audio: unknown, { onEnded, onChunk, Recorder = FakeRecorder }: Options = {}): { active: ActiveRecorder; recorder: FakeRecorder } {
  vi.stubGlobal("MediaRecorder", Recorder)
  vi.stubGlobal("AudioContext", Audio)
  const active = startRecording({} as MediaStream, { onChunk, onEnded })
  return { active, recorder: FakeRecorder.instances[FakeRecorder.instances.length - 1] }
}

beforeEach(() => {
  // One clock per test: a second useFakeTimers would drop pending timers.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance"] })
  vi.stubGlobal("window", globalThis)
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  FakeRecorder.instances = []
})

describe("startRecording's voice check", () => {
  it("reports null, not false, when the mic can't be read at all", async () => {
    const { active } = setup(noAudio)
    vi.advanceTimersByTime(3000)
    expect(active.speaking()).toBeNull()
    expect((await active.stop()).voiceHeard).toBeNull()
  })

  it("reports null while the AudioContext is suspended (autoplay policy), since silence then means nothing", async () => {
    const { active } = setup(fakeAudio(0, "suspended"))
    vi.advanceTimersByTime(3000)
    expect(active.speaking()).toBeNull()
    expect((await active.stop()).voiceHeard).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("suspended"))
  })

  it("judges the whole take, not the last tick: a context interrupted at the end keeps what it heard", async () => {
    const Audio = fakeAudio(0.1)
    const { active } = setup(Audio)
    vi.advanceTimersByTime(3000)
    // A phone call: the context stops running for the rest of the take.
    for (const context of Audio.instances) context.state = "suspended"
    vi.advanceTimersByTime(2000)
    expect(active.speaking()).toBeNull()
    expect((await active.stop()).voiceHeard).toBe(true)
  })

  it("needs two readable seconds before it says anything, so a late-starting context can't say no voice", async () => {
    const Audio = fakeAudio(0, "suspended")
    const { active } = setup(Audio)
    vi.advanceTimersByTime(10_000)
    for (const context of Audio.instances) context.state = "running"
    vi.advanceTimersByTime(1000)
    expect(active.speaking()).toBe(false)
    expect((await active.stop()).voiceHeard).toBeNull()
  })

  it("says nothing about a take it could hear for less than half of", async () => {
    const Audio = fakeAudio(0, "suspended")
    const { active, recorder } = setup(Audio)
    vi.advanceTimersByTime(20_000)
    for (const context of Audio.instances) context.state = "running"
    vi.advanceTimersByTime(3000)
    recorder.chunk()
    expect((await active.stop()).voiceHeard).toBeNull()
  })

  it("counts a tick that ran late as 250 ms, not as the whole gap, so a frozen main thread can't invent two seconds of voice", async () => {
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    const { active, recorder } = setup(fakeAudio(0.1))
    // The main thread froze for five seconds; one tick runs when it wakes.
    now = 5000
    vi.advanceTimersByTime(100)
    recorder.chunk()
    const take = await active.stop()
    expect(take.seconds).toBe(5)
    expect(take.voiceHeard).toBeNull()
  })

  it("reports false after a silent take and true after two seconds of voice", async () => {
    const silent = setup(fakeAudio(0))
    vi.advanceTimersByTime(3000)
    expect(silent.active.speaking()).toBe(false)
    expect((await silent.active.stop()).voiceHeard).toBe(false)

    const spoken = setup(fakeAudio(0.1))
    vi.advanceTimersByTime(1900)
    expect(spoken.active.speaking()).toBe(true)
    expect(spoken.active.level()).toBeGreaterThan(0)
    vi.advanceTimersByTime(200)
    expect((await spoken.active.stop()).voiceHeard).toBe(true)
  })
})

describe("startRecording's length and lifetime", () => {
  it("starts the recorder in one-second chunks, so a closed tab loses at most a second", () => {
    const { recorder } = setup(fakeAudio(0))
    expect(recorder.state).toBe("recording")
    expect(recorder.timeslice).toBe(1000)
  })

  it("rethrows a start() the browser refuses, leaving no mic sampler or AudioContext behind", () => {
    const Audio = fakeAudio(0)
    expect(() => setup(Audio, { Recorder: RefusingRecorder })).toThrow("can't record this stream")
    expect(Audio.closes).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(Audio.reads).toBe(0)
  })

  it("measures the take by the data it got, not by the clock", async () => {
    const { active, recorder } = setup(fakeAudio(0))
    vi.advanceTimersByTime(1000)
    recorder.chunk()
    vi.advanceTimersByTime(1000)
    recorder.chunk()
    // The camera died here: no more data, but the person goes on reading.
    vi.advanceTimersByTime(20_000)
    const take = await active.stop()
    expect(take.seconds).toBe(2)
    expect(take.blob.size).toBe(2)
    expect(take.cutOff).toBe(false)
  })

  it("tells the caller when the recorder stops on its own, and only then", async () => {
    const onEnded = vi.fn()
    const { active, recorder } = setup(fakeAudio(0), { onEnded })
    recorder.chunk()
    recorder.die(new DOMException("track ended", "InvalidStateError"))
    expect(onEnded).toHaveBeenCalledWith("error")
    expect(console.error).toHaveBeenCalled()
    // A later Finish still resolves with what there is.
    expect((await active.stop()).blob.size).toBe(1)

    const quiet = vi.fn()
    const second = setup(fakeAudio(0), { onEnded: quiet })
    await second.active.stop()
    expect(quiet).not.toHaveBeenCalled()
  })

  it("reports a stop without an error as ended", () => {
    const onEnded = vi.fn()
    const { recorder } = setup(fakeAudio(0), { onEnded })
    recorder.stop()
    expect(onEnded).toHaveBeenCalledWith("ended")
  })

  it("marks a take whose recorder failed as cut off, so the review can say so", async () => {
    const { active, recorder } = setup(fakeAudio(0), { onEnded: vi.fn() })
    recorder.chunk()
    recorder.die(new Error("encoder"))
    expect((await active.stop()).cutOff).toBe(true)
  })

  it("waits for the final data when Finish lands as the recorder is already winding down", async () => {
    const { active, recorder } = setup(fakeAudio(0))
    recorder.chunk()
    // The browser flips to inactive first; the last chunk and the stop event
    // are still on their way.
    recorder.state = "inactive"
    const pending = active.stop()
    recorder.chunk()
    recorder.onstop?.(new Event("stop"))
    expect((await pending).blob.size).toBe(2)
  })

  it("leaves no timer behind once a stop confirms, so the give-up never fires on a finished take", async () => {
    const { active, recorder } = setup(fakeAudio(0))
    recorder.chunk()
    await active.stop()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(STOP_TIMEOUT_MS)
    expect(console.error).not.toHaveBeenCalled()
  })

  it("answers a second stop() with the same take, and a stop() after cancel() at once, marked cut off", async () => {
    const { active, recorder } = setup(fakeAudio(0))
    recorder.chunk()
    const first = active.stop()
    expect(active.stop()).toBe(first)
    expect((await first).blob.size).toBe(1)

    const discarded = setup(fakeAudio(0), { Recorder: StuckRecorder })
    discarded.active.cancel()
    const late = await discarded.active.stop()
    expect(late.cutOff).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("lets cancel() end a stop() that is still waiting, marked cut off, without the give-up firing later", async () => {
    const { active, recorder } = setup(fakeAudio(0), { Recorder: StuckRecorder })
    recorder.chunk()
    const pending = active.stop()
    active.cancel()
    expect(vi.getTimerCount()).toBe(0)
    const take = await pending
    expect(take.blob.size).toBe(1)
    expect(take.cutOff).toBe(true)
    vi.advanceTimersByTime(STOP_TIMEOUT_MS)
    expect(console.error).not.toHaveBeenCalled()
  })

  it("drops a late chunk or error once a normal stop has settled, so it can't reach the saved take or the log", async () => {
    const onChunk = vi.fn()
    const onEnded = vi.fn()
    const { active, recorder } = setup(fakeAudio(0), { onChunk, onEnded })
    recorder.chunk()
    await active.stop()
    recorder.chunk()
    recorder.onerror?.({ error: new Error("late") })
    recorder.onstop?.(new Event("stop"))
    expect(onChunk).toHaveBeenCalledTimes(1)
    expect(onEnded).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it("drops a late chunk after Finish collects a take whose recorder had already died", async () => {
    const onChunk = vi.fn()
    const { active, recorder } = setup(fakeAudio(0), { onChunk, onEnded: vi.fn() })
    recorder.chunk()
    recorder.die(new Error("encoder"))
    await active.stop()
    recorder.chunk()
    expect(onChunk).toHaveBeenCalledTimes(1)
  })

  it("gives up on a stop that never confirms, keeping the data and marking the take cut off", async () => {
    const onChunk = vi.fn()
    const Audio = fakeAudio(0)
    const { active, recorder } = setup(Audio, { onChunk, Recorder: StuckRecorder })
    recorder.chunk()
    const pending = active.stop()
    await vi.advanceTimersByTimeAsync(STOP_TIMEOUT_MS)
    const take = await pending
    expect(take.blob.size).toBe(1)
    expect(take.cutOff).toBe(true)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("never confirmed"))
    // The sampler and context are gone, and late data isn't saved anywhere.
    expect(Audio.closes).toBe(1)
    recorder.chunk()
    expect(onChunk).toHaveBeenCalledTimes(1)
  })

  it("stays quiet when a discarded recorder stops (Start over is not a dead camera), and drops late data and errors", () => {
    const onEnded = vi.fn()
    const onChunk = vi.fn()
    const { active, recorder } = setup(fakeAudio(0), { onEnded, onChunk })
    recorder.chunk()
    active.cancel()
    expect(recorder.state).toBe("inactive")
    expect(onEnded).not.toHaveBeenCalled()
    // A chunk the browser flushes after cancel must not be saved into the next take.
    recorder.chunk()
    expect(onChunk).toHaveBeenCalledTimes(1)
    recorder.onerror?.({ error: new Error("late") })
    expect(console.error).not.toHaveBeenCalled()
  })
})
