"use client"

import { useEffect, useRef } from "react"

import { GUIDE } from "@/lib/studio/face-tracker"
import { cn } from "@/lib/utils"

// The vertical camera preview, phone-shaped, with a dashed oval where the
// face should sit. For a landscape webcam this is exactly the 9:16 crop that
// gets recorded (unless the camera reported no frame size and the full frame
// is recorded, see portrait.ts); a phone camera's own portrait frame is shown
// object-fit: cover, so anything beyond 9:16 is recorded but not previewed.
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
            rx={GUIDE.ovalRx}
            ry={GUIDE.ovalRy}
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
    // AbortError is the stream changing before play() settled; anything else
    // is a black preview worth a trace.
    if (stream) {
      void el.play().catch((error: unknown) => {
        if ((error as { name?: string } | null)?.name !== "AbortError") console.warn("Camera preview wouldn't play", error)
      })
    }
    onVideo?.(el)
    return () => onVideo?.(null)
  }, [stream, onVideo])
  return <video ref={video} muted playsInline autoPlay aria-label="Camera preview" className={cn("-scale-x-100", className)} />
}
