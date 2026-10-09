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
    let gaveUp = false
    let raf = 0
    let last = 0
    let failures = 0
    const giveUp = window.setTimeout(() => {
      if (cancelled) return
      gaveUp = true
      setStatus((s) => (s === "loading" ? "unavailable" : s))
    }, 20_000)

    loadFaceLandmarker()
      .then((landmarker) => {
        // A model that shows up after we gave up stays unused, so the
        // controls don't flip back to waiting on checks.
        if (cancelled || gaveUp) return
        window.clearTimeout(giveUp)
        setStatus("ready")
        const loop = (t: number) => {
          raf = requestAnimationFrame(loop)
          if (t - last < 66 || video.readyState < 2 || !video.videoWidth) return
          last = t
          try {
            callback.current(readFace(landmarker, video, t))
            failures = 0
          } catch {
            // A dropped frame is fine; two seconds of them (lost GPU context
            // after backgrounding, for one) means the tracker is gone.
            if (++failures >= 30) {
              cancelAnimationFrame(raf)
              setStatus("unavailable")
            }
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
