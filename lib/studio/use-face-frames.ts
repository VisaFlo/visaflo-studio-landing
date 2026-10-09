"use client"

import { useEffect, useRef, useState } from "react"

import { loadFaceLandmarker, readFace, type FaceFrame } from "@/lib/studio/face-tracker"

export type TrackerStatus = "loading" | "ready" | "unavailable"

// Runs the face landmarker on a live <video> about 15 times a second and
// hands each reading to `onFrame`. If the model can't load (old browser,
// blocked CDN, slow network) the status says so and the flow carries on
// without live checks.
export function useFaceFrames(video: HTMLVideoElement | null, onFrame: (frame: FaceFrame) => void): TrackerStatus {
  const [status, setStatus] = useState<TrackerStatus>("loading")
  const callback = useRef(onFrame)

  useEffect(() => {
    callback.current = onFrame
  })

  useEffect(() => {
    if (!video) return
    let cancelled = false
    let raf = 0
    let last = 0
    const giveUp = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "unavailable" : s))
    }, 20_000)

    loadFaceLandmarker()
      .then((landmarker) => {
        if (cancelled) return
        window.clearTimeout(giveUp)
        setStatus("ready")
        const loop = (t: number) => {
          raf = requestAnimationFrame(loop)
          if (t - last < 66 || video.readyState < 2 || !video.videoWidth) return
          last = t
          try {
            callback.current(readFace(landmarker, video, t))
          } catch {
            // A dropped frame is fine; the next one will do.
          }
        }
        raf = requestAnimationFrame(loop)
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable")
      })

    return () => {
      cancelled = true
      window.clearTimeout(giveUp)
      cancelAnimationFrame(raf)
    }
  }, [video])

  return status
}
