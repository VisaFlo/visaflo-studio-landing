"use client"

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
  source: "camera" | "upload"
  /** Camera recordings only: what the live checks saw. */
  checks?: { faceSeen: boolean; voiceHeard: boolean; headTurn: boolean }
}

export type ActiveRecorder = {
  stop: () => Promise<{ blob: Blob; mime: string; seconds: number; voiceHeard: boolean }>
  cancel: () => void
  /** Mic loudness right now, 0 to about 1. */
  level: () => number
  /** Whether the person is talking right now (null when the mic can't be read). */
  speaking: () => boolean | null
}

const VOICE_RMS = 0.02

// Records the camera stream and listens for a voice at the same time, so the
// review screen can say whether the mic picked anything up and the script can
// follow the person's reading. Each one-second chunk is handed to `onChunk`
// so a closed tab doesn't lose the take.
export function startRecording(
  stream: MediaStream,
  onChunk?: (chunk: Blob, index: number, mime: string) => void,
): ActiveRecorder {
  const mime = pickRecordingMime()
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 128_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size === 0) return
    chunks.push(event.data)
    onChunk?.(event.data, chunks.length - 1, recorder.mimeType || mime || "video/webm")
  }
  const startedAt = performance.now()
  recorder.start(1000)

  let voiceMs = 0
  let rms = 0
  let micReadable = false
  let audio: AudioContext | null = null
  let timer: number | undefined
  try {
    audio = new AudioContext()
    void audio.resume().catch(() => {})
    const analyser = audio.createAnalyser()
    analyser.fftSize = 1024
    audio.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += s * s
      rms = Math.sqrt(sum / samples.length)
      micReadable = true
      if (rms > VOICE_RMS) voiceMs += 100
    }, 100)
  } catch {
    voiceMs = Infinity
  }

  const cleanup = () => {
    window.clearInterval(timer)
    void audio?.close().catch(() => {})
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          cleanup()
          const type = recorder.mimeType || mime || "video/webm"
          resolve({
            blob: new Blob(chunks, { type }),
            mime: type,
            seconds: Math.round((performance.now() - startedAt) / 1000),
            voiceHeard: voiceMs >= 2000,
          })
        }
        if (recorder.state === "inactive") recorder.onstop(new Event("stop"))
        else recorder.stop()
      }),
    cancel: () => {
      cleanup()
      recorder.ondataavailable = null
      if (recorder.state !== "inactive") recorder.stop()
    },
    level: () => Math.min(1, rms * 8),
    speaking: () => (micReadable ? rms > VOICE_RMS : null),
  }
}
