"use client"

// The sample video VisaFlo edits from this recording is a vertical short, so
// the recording is vertical from the start. A phone held upright is recorded
// in its own portrait frame (exactly 9:16, or 3:4 and so a little wider); a
// laptop webcam gives 16:9, and we keep only its middle 9:16 column (the
// preview shows exactly that, so people frame themselves for it).

export type Crop = { x: number; y: number; w: number; h: number }

export function portraitCrop(width: number, height: number): Crop {
  // Even widths only: video encoders want them.
  const w = Math.min(width, Math.round((height * 9) / 16 / 2) * 2)
  return { x: Math.round((width - w) / 2), y: 0, w, h: height }
}

type Size = { width: number; height: number }

// The crop to use once the first frame's real size is known, or null when
// the track's settings were right (or the size isn't known yet). Some phone
// browsers have reported the sensor's landscape size for an upright camera;
// if the frames turn out portrait, the whole frame is kept.
export function actualCrop(reported: Size, actual: Size): Crop | null {
  if (!actual.width || !actual.height || (actual.width === reported.width && actual.height === reported.height)) return null
  return actual.height >= actual.width ? { x: 0, y: 0, w: actual.width, h: actual.height } : portraitCrop(actual.width, actual.height)
}

export type PortraitStream = {
  stream: MediaStream
  /** Releases only what portraitStream made (the canvas track and its timer), never the camera's own tracks. */
  stop: () => void
}

const FPS = 30

// A stream whose video is the portrait crop of `source`'s camera, with the
// same audio. For a portrait or square camera it is `source` itself.
export function portraitStream(source: MediaStream): PortraitStream {
  const track = source.getVideoTracks()[0]
  const { width = 0, height = 0 } = track?.getSettings() ?? {}
  if (!track) return { stream: source, stop: () => {} }
  if (!width || !height) {
    // Some browsers report no size before the first frame; the recording
    // then keeps the camera's own frame, which the editor fits later.
    console.warn("portraitStream: the camera reported no frame size; recording it as is")
    return { stream: source, stop: () => {} }
  }
  if (height >= width) return { stream: source, stop: () => {} }

  let crop = portraitCrop(width, height)
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.srcObject = new MediaStream([track])
  void video.play().catch((error: unknown) => console.warn("portraitStream: the camera video wouldn't play", error))

  const canvas = document.createElement("canvas")
  canvas.width = crop.w
  canvas.height = crop.h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D is unavailable, so the camera frame can't be cropped")

  // The settings above are what the track claims; the frames are what count.
  // This fires during the align step, before any take can start, so the
  // canvas is never resized mid-recording.
  video.addEventListener(
    "loadedmetadata",
    () => {
      const next = actualCrop({ width, height }, { width: video.videoWidth, height: video.videoHeight })
      if (!next) return
      console.warn(`portraitStream: the camera reported ${width}×${height} but delivers ${video.videoWidth}×${video.videoHeight}; recropping`)
      crop = next
      canvas.width = crop.w
      canvas.height = crop.h
    },
    { once: true },
  )

  // readyState 2 is HAVE_CURRENT_DATA: a frame is there to copy. A timer
  // rather than requestAnimationFrame: rAF stops completely while the tab is
  // hidden; a timer keeps firing, throttled to about once a second, and in
  // Chrome to once a minute after roughly ten seconds hidden (Chrome 109+;
  // five minutes before that). That gives a hidden tab a chance of a
  // stuttering recording instead of a certain freeze.
  const draw = () => {
    if (video.readyState >= 2) ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
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
