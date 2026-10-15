"use client"

import type { Check } from "@/lib/studio/checks"

// The portrait photo: one still of the vertical frame the person framed
// themselves in, at the size the camera gives it. The preview is mirrored
// (like a mirror, as people expect); the photo is not, so text and
// asymmetries come out the way others see them, same as the recording.
export type Photo = {
  blob: Blob
  /** An object URL of `blob` for the review; the flow revokes it. */
  url: string
  width: number
  height: number
  /** Whether the framing check saw a face when it was taken; null when the check never ran. */
  faceSeen: Check
}

export const PHOTO_MIME = "image/jpeg"
/** The storage rules refuse a photo of 10 MB or more; a camera frame as JPEG is far below that. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

// The frame `video` (the portrait preview) shows right now, as a JPEG. For a
// landscape webcam the preview is already the 9:16 crop (portrait.ts), so
// the photo matches what was framed; a phone's own portrait frame is kept
// whole, as the recording keeps it.
export async function capturePhoto(video: HTMLVideoElement, faceSeen: Check): Promise<Photo> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) throw new Error("The camera preview has no frame to take a photo of yet")
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("This browser can't draw the camera frame")
  context.drawImage(video, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, PHOTO_MIME, 0.92))
  if (!blob || blob.size === 0) throw new Error("The camera frame couldn't be saved as a photo")
  return { blob, url: URL.createObjectURL(blob), width, height, faceSeen }
}
