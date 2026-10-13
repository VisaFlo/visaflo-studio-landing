"use client"

import type { Check, RecordingChecks } from "@/lib/studio/checks"

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

export function extensionFor(mime: string): string {
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
export type StoppedTake = { blob: Blob; mime: string; seconds: number; voiceHeard: Check }

export type ActiveRecorder = {
  /** voiceHeard is null when the mic couldn't be read, not false. */
  stop: () => Promise<StoppedTake>
  cancel: () => void
  /** Mic loudness right now, 0 to about 1. */
  level: () => number
  /** Whether the person is talking right now (null when the mic can't be read). */
  speaking: () => boolean | null
}

export type RecorderOptions = {
  /** Each one-second chunk as it is encoded, so a closed tab doesn't lose the take. */
  onChunk?: (chunk: Blob, index: number, mime: string) => void
  /**
   * The recorder stopped without being asked: "error" after a MediaRecorder
   * error (encoder failure, a track that ended when the camera went away),
   * "ended" when it just stopped. The take is cut off from here on.
   */
  onEnded?: (reason: "error" | "ended") => void
}

/** Signal level (RMS of the samples) above which the mic is hearing a voice rather than room noise. */
const VOICE_RMS = 0.02
/** Milliseconds above VOICE_RMS over the whole take for the voice check to pass. */
const VOICE_NEEDED_MS = 2000

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
  const startedAt = performance.now()
  // When the last data arrived: the length of what was really recorded, even
  // if the recorder died while the person kept reading.
  let lastDataAt = startedAt
  recorder.ondataavailable = (event) => {
    if (event.data.size === 0) return
    chunks.push(event.data)
    lastDataAt = performance.now()
    onChunk?.(event.data, chunks.length - 1, recorder.mimeType || mime || "video/webm")
  }

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
    timer = window.setInterval(() => {
      // A context the autoplay policy keeps suspended reads silence; that is
      // "not checked", never "no voice".
      if (context.state !== "running") {
        micReadable = false
        if (!warnedSuspended && performance.now() - startedAt > 1000) {
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
      if (rms > VOICE_RMS) voiceMs += 100
    }, 100)
  } catch (error) {
    // AudioContext itself couldn't be built (old browser, no Web Audio):
    // record anyway and report the voice check as not run.
    console.warn("Mic level can't be read; recording without the voice check", error)
  }

  const cleanup = () => {
    window.clearInterval(timer)
    void audio?.close().catch(() => {})
  }

  const finish = (): StoppedTake => {
    cleanup()
    const type = recorder.mimeType || mime || "video/webm"
    return {
      blob: new Blob(chunks, { type }),
      mime: type,
      seconds: Math.round((lastDataAt - startedAt) / 1000),
      voiceHeard: micReadable ? voiceMs >= VOICE_NEEDED_MS : null,
    }
  }

  // Installed now, not inside stop(): a recorder that stops on its own must
  // be noticed, or the clock keeps running over a dead take.
  let stopping: ((take: StoppedTake) => void) | null = null
  let failed = false
  recorder.onerror = (event) => {
    failed = true
    console.error("MediaRecorder error", (event as { error?: unknown }).error ?? event)
  }
  recorder.onstop = () => {
    if (stopping) stopping(finish())
    else {
      cleanup()
      onEnded?.(failed ? "error" : "ended")
    }
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        stopping = resolve
        if (recorder.state === "inactive") resolve(finish())
        else recorder.stop()
      }),
    cancel: () => {
      cleanup()
      recorder.ondataavailable = null
      recorder.onstop = null
      if (recorder.state !== "inactive") recorder.stop()
    },
    level: () => Math.min(1, rms * 8),
    speaking: () => (micReadable ? rms > VOICE_RMS : null),
  }
}
