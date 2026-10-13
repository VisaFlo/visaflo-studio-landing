"use client"

import type { Check, RecordingChecks } from "@/lib/studio/checks"
import type { RecordingExtension } from "@/lib/studio/project"

// MediaRecorder container the browser can write: MP4 on Safari, WebM on
// Chrome and Firefox (newer Chrome can do MP4 too, which we prefer).
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
]

export function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

// The file name the upload gets: only what the storage rules accept.
export function extensionFor(mime: string): RecordingExtension {
  if (mime.includes("mp4")) return "mp4"
  if (mime.includes("quicktime")) return "mov"
  if (mime.includes("x-m4v")) return "m4v"
  return "webm"
}

export type Recording = {
  blob: Blob
  url: string
  mime: string
  seconds: number
  source: "camera"
  /** What the live checks saw; absent for a take recovered after the page closed mid-recording. */
  checks?: RecordingChecks
}

/** A finished take. `seconds` is how much was actually recorded, from the data the recorder produced. */
export type StoppedTake = {
  blob: Blob
  mime: string
  seconds: number
  voiceHeard: Check
  /**
   * The take ends early: the recorder reported an error after Finish was
   * pressed, or never confirmed stopping (an error before Finish goes through
   * `onEnded` instead).
   */
  cutOff: boolean
}

export type ActiveRecorder = {
  /**
   * Finishes the take. Resolves once the recorder has handed over its last
   * data, or after `timeoutMs` with what there is (then `cutOff`). Cleans up
   * either way. voiceHeard is null when the mic couldn't be read for enough of
   * the take to say anything.
   */
  stop: (timeoutMs?: number) => Promise<StoppedTake>
  /** Discards the take: nothing is reported, saved or resolved after this. */
  cancel: () => void
  /** Mic loudness right now, 0 to 1. */
  level: () => number
  /** Whether the person is talking right now (null when the mic can't be read). */
  speaking: () => boolean | null
}

export type RecorderOptions = {
  /** Each one-second chunk as it is encoded, so a closed tab doesn't lose the take. */
  onChunk?: (chunk: Blob, index: number) => void
  /**
   * The recorder stopped without being asked: "error" after a MediaRecorder
   * error (an encoder or browser failure), "ended" when it just stopped,
   * which is what the browser does when the camera's tracks end. The take
   * is cut off from here on.
   */
  onEnded?: (reason: "error" | "ended") => void
}

/** Signal level (RMS of the samples) above which the mic is hearing a voice rather than room noise. */
const VOICE_RMS = 0.02
/** Milliseconds above VOICE_RMS over the whole take for the voice check to pass. */
const VOICE_NEEDED_MS = 2000
/** A tick that ran this late (a busy main thread) is counted as this much, not as the whole gap. */
const MAX_TICK_MS = 250
/** How long stop() waits for the recorder's final data before keeping what it has. */
export const STOP_TIMEOUT_MS = 5000

// Records the camera stream and listens for a voice at the same time, so the
// review screen can say whether the mic picked anything up and the script can
// follow the person's reading.
export function startRecording(stream: MediaStream, { onChunk, onEnded }: RecorderOptions = {}): ActiveRecorder {
  const mime = pickRecordingMime()
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 128_000,
  })
  const chunks: Blob[] = []
  let startedAt = 0
  // When the last data arrived: the length of what was really recorded, even
  // if the recorder died while the person kept reading.
  let lastDataAt = 0
  recorder.ondataavailable = (event) => {
    if (event.data.size === 0) return
    chunks.push(event.data)
    lastDataAt = performance.now()
    onChunk?.(event.data, chunks.length - 1)
  }

  // Time the mic could be read (the context was running) and, within that,
  // time a voice was heard. The check needs enough readable time to mean
  // anything: a context the autoplay policy kept suspended would read as
  // silence, so those ticks are not counted at all; that is "not checked",
  // never "no voice". Time is measured between ticks, not assumed from the
  // interval, because a busy main thread runs ticks late.
  let readableMs = 0
  let voiceMs = 0
  let rms = 0
  let micReadable = false
  let audio: AudioContext | null = null
  let timer: number | undefined
  try {
    audio = new AudioContext()
    void audio.resume().catch((error: unknown) => console.warn("AudioContext.resume failed; the voice check may not run", error))
    const analyser = audio.createAnalyser()
    analyser.fftSize = 1024
    audio.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const context = audio
    let warnedSuspended = false
    let lastTick = performance.now()
    timer = window.setInterval(() => {
      const now = performance.now()
      const gap = Math.min(MAX_TICK_MS, now - lastTick)
      lastTick = now
      if (context.state !== "running") {
        micReadable = false
        if (!warnedSuspended && now - startedAt > 1000) {
          warnedSuspended = true
          console.warn(`AudioContext is ${context.state}; recording without the voice check`)
        }
        return
      }
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += s * s
      rms = Math.sqrt(sum / samples.length)
      micReadable = true
      readableMs += gap
      if (rms > VOICE_RMS) voiceMs += gap
    }, 100)
  } catch (error) {
    // Web Audio couldn't be set up (no AudioContext, or the stream has no
    // audio track): record anyway and report the voice check as not run.
    console.warn("Mic level can't be read; recording without the voice check", error)
  }

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.clearInterval(timer)
    void audio?.close().catch((error: unknown) => console.warn("AudioContext.close failed", error))
  }

  // Nothing more may come from this recorder: used by cancel() and by a stop
  // that gave up waiting, so a late chunk or error isn't saved or logged.
  const detach = () => {
    recorder.ondataavailable = null
    recorder.onstop = null
    recorder.onerror = null
  }

  let failed = false
  const finish = (): StoppedTake => {
    cleanup()
    const type = recorder.mimeType || mime || "video/webm"
    const takeMs = lastDataAt - startedAt
    return {
      blob: new Blob(chunks, { type }),
      mime: type,
      seconds: Math.max(0, Math.round(takeMs / 1000)),
      // Judged over the whole take, not the last tick, and only when the mic
      // could be read for at least two seconds and at least half the take: a
      // context interrupted at the end keeps what it heard; one that woke up
      // for the last moments has nothing to say.
      voiceHeard: readableMs >= VOICE_NEEDED_MS && readableMs >= takeMs / 2 ? voiceMs >= VOICE_NEEDED_MS : null,
      cutOff: failed,
    }
  }

  // Installed before start(), not inside stop(): a recorder that stops on
  // its own must be noticed, or the flow keeps the script clock running and
  // the mic sampler alive over a dead take.
  let stopping: ((take: StoppedTake) => void) | null = null
  let ended = false
  recorder.onerror = (event) => {
    failed = true
    console.error("MediaRecorder error", (event as { error?: unknown }).error ?? event)
  }
  recorder.onstop = () => {
    ended = true
    if (stopping) stopping(finish())
    else {
      cleanup()
      onEnded?.(failed ? "error" : "ended")
    }
  }

  // One-second chunks, so a closed tab loses at most a second. A start()
  // that throws (this browser can't record the stream) reaches the caller.
  startedAt = lastDataAt = performance.now()
  try {
    recorder.start(1000)
  } catch (error) {
    cleanup()
    throw error
  }

  return {
    stop: (timeoutMs = STOP_TIMEOUT_MS) =>
      new Promise((resolve) => {
        // Already stopped and reported: everything is in hand.
        if (ended) return resolve(finish())
        // Otherwise the stop event is still to come, even when the state has
        // already flipped to inactive: the browser sends the last chunk and
        // the stop event as later tasks, so wait for them rather than build
        // the file without its final piece.
        const giveUp = window.setTimeout(() => {
          console.error(`MediaRecorder never confirmed stopping within ${timeoutMs} ms; keeping what was recorded`)
          failed = true
          detach()
          resolve(finish())
        }, timeoutMs)
        stopping = (take) => {
          window.clearTimeout(giveUp)
          resolve(take)
        }
        if (recorder.state !== "inactive") recorder.stop()
      }),
    cancel: () => {
      cleanup()
      detach()
      if (recorder.state !== "inactive") recorder.stop()
    },
    level: () => Math.min(1, rms * 8),
    speaking: () => (micReadable ? rms > VOICE_RMS : null),
  }
}
