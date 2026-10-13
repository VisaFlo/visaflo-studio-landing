import { afterEach, describe, expect, it, vi } from "vitest"

import { startRecording, type ActiveRecorder } from "@/lib/studio/recorder"

// Just enough MediaRecorder to drive startRecording: data and stop events are
// fired by the test, the way the browser would.
class FakeRecorder {
  static instances: FakeRecorder[] = []
  static isTypeSupported = () => true
  state: "recording" | "inactive" = "recording"
  mimeType = "video/webm"
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: ((event: Event) => void) | null = null
  onerror: ((event: { error?: unknown }) => void) | null = null
  constructor() {
    FakeRecorder.instances.push(this)
  }
  start() {}
  stop() {
    this.state = "inactive"
    this.onstop?.(new Event("stop"))
  }
  // What the browser does when the encoder or a track dies.
  die(error: unknown) {
    this.onerror?.({ error })
    this.stop()
  }
  chunk(bytes = 1) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) })
  }
}

// An AudioContext whose analyser always reads the same signal level.
const fakeAudio = (rms: number, state: "running" | "suspended" = "running") =>
  class {
    state = state
    resume = async () => {}
    close = async () => {}
    createAnalyser = () => ({ fftSize: 1024, getFloatTimeDomainData: (samples: Float32Array) => samples.fill(rms) })
    createMediaStreamSource = () => ({ connect() {} })
  }

const noAudio = class {
  constructor() {
    throw new Error("no Web Audio")
  }
}

function setup(Audio: unknown, onEnded?: (reason: "error" | "ended") => void): { active: ActiveRecorder; recorder: FakeRecorder } {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance"] })
  vi.stubGlobal("window", globalThis)
  vi.stubGlobal("MediaRecorder", FakeRecorder)
  vi.stubGlobal("AudioContext", Audio)
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
  const active = startRecording({} as MediaStream, { onEnded })
  return { active, recorder: FakeRecorder.instances[FakeRecorder.instances.length - 1] }
}

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
  })

  it("tells the caller when the recorder stops on its own, and only then", async () => {
    const onEnded = vi.fn()
    const { active, recorder } = setup(fakeAudio(0), onEnded)
    recorder.chunk()
    recorder.die(new DOMException("track ended", "InvalidStateError"))
    expect(onEnded).toHaveBeenCalledWith("error")
    expect(console.error).toHaveBeenCalled()
    // A later Finish still resolves with what there is.
    expect((await active.stop()).blob.size).toBe(1)

    const quiet = vi.fn()
    const second = setup(fakeAudio(0), quiet)
    await second.active.stop()
    expect(quiet).not.toHaveBeenCalled()
  })

  it("reports a stop without an error as ended", () => {
    const onEnded = vi.fn()
    const { recorder } = setup(fakeAudio(0), onEnded)
    recorder.stop()
    expect(onEnded).toHaveBeenCalledWith("ended")
  })
})
