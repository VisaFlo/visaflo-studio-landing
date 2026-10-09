"use client"

import { useEffect, useRef } from "react"

import { RING_TICKS } from "@/lib/studio/face-tracker"
import { cn } from "@/lib/utils"

// The circular camera preview with a ring of ticks around it, Face ID style.
// Ticks in `done` turn black and grow as the head turns toward them.
export function FaceRing({
  stream,
  done,
  dim,
  onVideo,
  children,
}: {
  stream: MediaStream | null
  done?: Set<number>
  dim?: boolean
  onVideo?: (video: HTMLVideoElement | null) => void
  /** Overlays drawn on top of the ring (countdown, guide dot, badges). */
  children?: React.ReactNode
}) {
  const ticks = Array.from({ length: RING_TICKS }, (_, i) => i)
  return (
    <div className="relative aspect-square w-[min(440px,86vw)] shrink-0">
      <svg viewBox="0 0 440 440" className="absolute inset-0 size-full" aria-hidden>
        {ticks.map((i) => {
          const on = done?.has(i)
          return (
            <line
              key={i}
              x1="220"
              x2="220"
              y1={on ? 4 : 6}
              y2={on ? 20 : 18}
              stroke={on ? "#0c0a09" : "#d6d3d1"}
              strokeWidth="2"
              transform={`rotate(${i * (360 / RING_TICKS)} 220 220)`}
            />
          )
        })}
      </svg>
      <div className="absolute inset-[6.4%] overflow-hidden rounded-full bg-stone-700">
        <CameraVideo
          stream={stream}
          onVideo={onVideo}
          className={cn("size-full object-cover transition-[filter]", dim && "brightness-[0.62]")}
        />
      </div>
      {children}
    </div>
  )
}

// A muted, mirrored live preview of the camera stream.
export function CameraVideo({
  stream,
  className,
  onVideo,
}: {
  stream: MediaStream | null
  className?: string
  onVideo?: (video: HTMLVideoElement | null) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = video.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => {})
    onVideo?.(el)
    return () => onVideo?.(null)
  }, [stream, onVideo])
  return <video ref={video} muted playsInline autoPlay aria-label="Camera preview" className={cn("-scale-x-100", className)} />
}
