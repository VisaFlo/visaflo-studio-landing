"use client"

import type { FaceLandmarker } from "@mediapipe/tasks-vision"

import { portraitCrop } from "@/lib/studio/portrait"

// MediaPipe Face Landmarker, loaded on demand so the landing page never pays
// for it. The WASM runtime is pinned to the installed package version.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm"
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

let loading: Promise<FaceLandmarker> | null = null

export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  loading ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision")
    const files = await FilesetResolver.forVisionTasks(WASM_BASE)
    const create = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      })
    try {
      return await create("GPU")
    } catch {
      return await create("CPU")
    }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}

// One reading of the face, in the coordinates of the vertical, mirrored
// preview the person sees (0..1 of its width and height, origin top left).
export type FaceFrame =
  | { found: false }
  | {
      found: true
      cx: number
      cy: number
      /** Face width as a share of the preview's width. */
      size: number
      /** Nose offset from the face's center, + is toward the preview's right. */
      yaw: number
      /** Nose offset from the face's center, + is down. */
      pitch: number
      /** Mean brightness of the face, 0 to 255. */
      light: number
    }

const NOSE = 1
const LEFT_EDGE = 234
const RIGHT_EDGE = 454
const FOREHEAD = 10
const CHIN = 152

let sampler: CanvasRenderingContext2D | null = null

function faceBrightness(video: HTMLVideoElement, x: number, y: number, w: number, h: number): number {
  sampler ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!sampler) return 255
  const side = 24
  sampler.canvas.width = side
  sampler.canvas.height = side
  sampler.drawImage(video, x, y, w, h, 0, 0, side, side)
  const { data } = sampler.getImageData(0, 0, side, side)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  return sum / (data.length / 4)
}

export function readFace(landmarker: FaceLandmarker, video: HTMLVideoElement, at: number): FaceFrame {
  const result = landmarker.detectForVideo(video, at)
  const points = result.faceLandmarks[0]
  if (!points) return { found: false }

  const vw = video.videoWidth
  const vh = video.videoHeight
  // The preview is the portrait crop of the camera (the whole frame when the
  // camera is already portrait), so positions are measured within it.
  const crop = portraitCrop(vw, vh)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x * vw)
    maxX = Math.max(maxX, p.x * vw)
    minY = Math.min(minY, p.y * vh)
    maxY = Math.max(maxY, p.y * vh)
  }

  const nose = points[NOSE]
  const midX = ((points[LEFT_EDGE].x + points[RIGHT_EDGE].x) / 2) * vw
  const width = Math.abs(points[RIGHT_EDGE].x - points[LEFT_EDGE].x) * vw || 1
  const midY = ((points[FOREHEAD].y + points[CHIN].y) / 2) * vh
  const height = Math.abs(points[CHIN].y - points[FOREHEAD].y) * vh || 1

  return {
    found: true,
    // The preview is mirrored, so x flips.
    cx: 1 - ((minX + maxX) / 2 - crop.x) / crop.w,
    cy: ((minY + maxY) / 2 - crop.y) / crop.h,
    size: (maxX - minX) / crop.w,
    yaw: -(nose.x * vw - midX) / width,
    pitch: (nose.y * vh - midY) / height,
    light: faceBrightness(video, minX, minY, maxX - minX, maxY - minY),
  }
}

export type AlignCheck = { inFrame: boolean; distance: "ok" | "closer" | "back"; light: boolean }

// Where the face should sit in the vertical frame: centred, a little above
// the middle (like a phone selfie), filling roughly a third to a half of the
// width.
export const GUIDE = { cx: 0.5, cy: 0.4, tolerance: 0.14, minSize: 0.3, maxSize: 0.62 }

export function checkAlignment(frame: FaceFrame): AlignCheck | null {
  if (!frame.found) return null
  return {
    inFrame: Math.abs(frame.cx - GUIDE.cx) < GUIDE.tolerance && Math.abs(frame.cy - GUIDE.cy) < GUIDE.tolerance,
    distance: frame.size < GUIDE.minSize ? "closer" : frame.size > GUIDE.maxSize ? "back" : "ok",
    light: frame.light >= 70,
  }
}
