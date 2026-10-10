"use client"

import { useEffect, useRef } from "react"

import { GUIDE } from "@/lib/studio/face-tracker"
import { cn } from "@/lib/utils"

// The vertical camera preview, phone-shaped, showing exactly what will be
// recorded, with a dashed oval where the face should sit.
export function PortraitFrame({
  stream,
  dim,
  guide = true,
  onVideo,
  children,
}: {
  stream: MediaStream | null
  dim?: boolean
  guide?: boolean
  onVideo?: (video: HTMLVideoElement | null) => void
  /** Overlays drawn on top of the preview (countdown, badges). */
  children?: React.ReactNode
}) {
  return (
    <div className="relative aspect-[9/16] h-[min(560px,70vh)] shrink-0 overflow-hidden rounded-[28px] bg-stone-700">
      <CameraVideo
        stream={stream}
        onVideo={onVideo}
        className={cn("size-full object-cover transition-[filter]", dim && "brightness-[0.62]")}
      />
      {guide && (
        <svg viewBox="0 0 90 160" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <ellipse
            cx={GUIDE.cx * 90}
            cy={GUIDE.cy * 160}
            rx={21}
            ry={27}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.8"
            strokeDasharray="2.5 2.5"
          />
        </svg>
      )}
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
