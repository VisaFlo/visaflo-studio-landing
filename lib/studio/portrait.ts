"use client"

// The sample is a vertical short, so the recording is vertical from the
// start. A phone held upright already gives 9:16; a laptop webcam gives
// 16:9, and we keep only its middle 9:16 column (the preview shows exactly
// that, so people frame themselves for it).

export type Crop = { x: number; y: number; w: number; h: number }

export function portraitCrop(width: number, height: number): Crop {
  // Even widths only: video encoders want them.
  const w = Math.min(width, Math.round((height * 9) / 16 / 2) * 2)
  return { x: Math.round((width - w) / 2), y: 0, w, h: height }
}

export type PortraitStream = { stream: MediaStream; stop: () => void }

const FPS = 30

// A stream whose video is the portrait crop of `source`'s camera, with the
// same audio. For a portrait camera it is `source` itself.
export function portraitStream(source: MediaStream): PortraitStream {
  const track = source.getVideoTracks()[0]
  const { width = 0, height = 0 } = track?.getSettings() ?? {}
  if (!track || !width || !height || height >= width) return { stream: source, stop: () => {} }

  const crop = portraitCrop(width, height)
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.srcObject = new MediaStream([track])
  void video.play().catch(() => {})

  const canvas = document.createElement("canvas")
  canvas.width = crop.w
  canvas.height = crop.h
  const ctx = canvas.getContext("2d")
  const draw = () => {
    if (ctx && video.readyState >= 2) ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
  }
  const timer = window.setInterval(draw, 1000 / FPS)

  const stream = canvas.captureStream(FPS)
  for (const audio of source.getAudioTracks()) stream.addTrack(audio)
  return {
    stream,
    stop: () => {
      window.clearInterval(timer)
      video.srcObject = null
      stream.getVideoTracks().forEach((t) => t.stop())
    },
  }
}
