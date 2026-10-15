"use client"

import type { FaceLandmarker } from "@mediapipe/tasks-vision"

import { portraitCrop } from "@/lib/studio/portrait"

// MediaPipe Face Landmarker, loaded on demand so the landing page never pays
// for it. The WASM runtime is pinned to 1.1.0, which the lockfile resolves
// @mediapipe/tasks-vision to; bump WASM_BASE and the package together.
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
    } catch (error) {
      // CPU is slower and warmer; a device that keeps coming back with the
      // face check not run (the 20 s give-up) or failing is worth matching
      // against this line.
      console.warn("Face landmarker GPU delegate failed, using CPU", error)
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
      /** Mean brightness of the face, 0 to 255. */
      light: number
    }

export type FaceGeometry = {
  cx: number
  cy: number
  size: number
  /** The landmarks' bounding box in camera pixels, for sampling brightness. */
  box: { x: number; y: number; w: number; h: number }
}

// Where the landmarks' bounding box sits in the mirrored portrait preview.
// The preview is the portrait crop of the camera (the whole frame when the
// camera is already portrait), so positions are measured within that crop,
// and x flips because the preview is mirrored. Null without landmarks (no
// NaN). Pure, so it is tested without a browser.
export function faceGeometry(points: { x: number; y: number }[], vw: number, vh: number): FaceGeometry | null {
  if (!points.length) return null
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
  return {
    cx: 1 - ((minX + maxX) / 2 - crop.x) / crop.w,
    cy: ((minY + maxY) / 2 - crop.y) / crop.h,
    size: (maxX - minX) / crop.w,
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  }
}

let sampler: CanvasRenderingContext2D | null | undefined

// Mean brightness of the face box. The result only drives the live "Light"
// hint while framing (it is not recorded anywhere), so without a 2D context
// it reads as lit, once logged, rather than blocking the person.
function faceBrightness(video: HTMLVideoElement, box: FaceGeometry["box"]): number {
  if (sampler === undefined) {
    sampler = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    if (!sampler) console.warn("Canvas 2D is unavailable; the light check is skipped")
  }
  if (!sampler) return 255
  const side = 24
  sampler.canvas.width = side
  sampler.canvas.height = side
  sampler.drawImage(video, box.x, box.y, box.w, box.h, 0, 0, side, side)
  const { data } = sampler.getImageData(0, 0, side, side)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  return sum / (data.length / 4)
}

export function readFace(landmarker: FaceLandmarker, video: HTMLVideoElement, at: number): FaceFrame {
  const result = landmarker.detectForVideo(video, at)
  const geometry = faceGeometry(result.faceLandmarks[0] ?? [], video.videoWidth, video.videoHeight)
  if (!geometry) return { found: false }
  const { cx, cy, size, box } = geometry
  return { found: true, cx, cy, size, light: faceBrightness(video, box) }
}

export type AlignCheck = { inFrame: boolean; distance: "ok" | "closer" | "back"; light: boolean }

// Where the face should sit in the vertical frame: centred, a little above
// the middle (like a phone selfie), filling roughly a third to three fifths
// of the width, with enough light on it. The framing screens show no oval;
// the one on the full-screen recording (camera-frame.tsx) is a generous
// target to stay in, not this check.
export const GUIDE = {
  cx: 0.5,
  cy: 0.4,
  tolerance: 0.14,
  minSize: 0.3,
  maxSize: 0.62,
  /** Mean face brightness, 0 to 255. */
  minLight: 70,
} as const

export function checkAlignment(frame: FaceFrame): AlignCheck | null {
  if (!frame.found) return null
  return {
    inFrame: Math.abs(frame.cx - GUIDE.cx) < GUIDE.tolerance && Math.abs(frame.cy - GUIDE.cy) < GUIDE.tolerance,
    distance: frame.size < GUIDE.minSize ? "closer" : frame.size > GUIDE.maxSize ? "back" : "ok",
    light: frame.light >= GUIDE.minLight,
  }
}
