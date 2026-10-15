"use client"

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react"

import { DoneMark } from "@/components/studio/ui"
import { cn } from "@/lib/utils"

// The vertical 9:16 frame every camera screen uses (photo, photo review,
// video, video review), as tall as the window allows with the two buttons
// and the link under it still in view. It is the same size and in the same
// place on all of them, so nothing moves between taking and checking. For a
// landscape webcam the picture is exactly the 9:16 crop that gets recorded
// (see portrait.ts); a phone camera's own portrait frame is shown
// object-fit: cover. `children` are the picture and its overlays.
const SHOT_HEIGHT = "max(320px, min(calc(100dvh - 208px), calc((100vw - 32px) * 16 / 9)))"

export function ShotFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative aspect-[9/16] max-w-full shrink-0 overflow-hidden rounded-[20px] bg-stone-900 text-white"
      style={{ height: SHOT_HEIGHT }}
    >
      {children}
    </div>
  )
}

// The camera screens' layout: the frame, the two buttons right under it, then
// one line (a link, or an error) or the same height left empty.
export function ShotLayout({ frame, buttons, below }: { frame: ReactNode; buttons: ReactNode; below?: ReactNode }) {
  return (
    <main className="flex flex-grow flex-col items-center justify-center gap-4 p-4">
      {frame}
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-2">{buttons}</div>
        <div className="flex min-h-11 items-center">{below}</div>
      </div>
    </main>
  )
}

// The small buttons under the frame: a quiet one, then the main one.
export function ShotButton({ primary, className, ...props }: ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button
      className={cn(
        "flex h-9 items-center justify-center gap-2 text-[14px] font-medium",
        primary
          ? "bg-stone-950 px-4 text-white hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-500"
          : "border border-stone-300 bg-white px-3.5 text-stone-950 hover:border-stone-950",
        className,
      )}
      {...props}
    />
  )
}

// A pill on the picture: "Preview" top left, a status at the bottom.
export function PreviewBadge() {
  return (
    <span className="absolute top-3.5 left-3.5 flex h-[30px] items-center gap-1.5 rounded-full bg-stone-950/60 px-3 text-[13px] font-medium text-white">
      <span className="size-2 rounded-full bg-red-500" aria-hidden />
      Preview
    </span>
  )
}

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "plain"; children: ReactNode }) {
  return (
    <span
      role="status"
      className={cn(
        "absolute bottom-4 left-1/2 flex h-[34px] -translate-x-1/2 items-center gap-2 rounded-full px-3.5 text-[14px] font-medium whitespace-nowrap",
        tone === "ok" ? "bg-[#3a4536] text-white" : tone === "warn" ? "bg-[#c2410c] text-white" : "bg-stone-950/60 text-white",
      )}
    >
      {tone === "ok" && <DoneMark className="size-4 stroke-white" />}
      {children}
    </span>
  )
}

// Countdown and recording go full screen, like HeyGen: the vertical camera
// from the top of the window to the bottom on grey, a big oval to stay in, the
// script in a dark box at the top (above the head, near the camera), the clock
// and a close button top right, and `bottom` (Finish) at the bottom.
export function FullScreenStage({
  stream,
  dim,
  script,
  corner,
  bottom,
  children,
}: {
  stream: MediaStream
  dim?: boolean
  script: ReactNode
  corner: ReactNode
  bottom?: ReactNode
  /** Overlays on the picture (the countdown). */
  children?: ReactNode
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Recording" className="fixed inset-0 z-50 flex justify-center overflow-hidden bg-[#575757] text-white">
      <div className="relative aspect-[9/16] h-full max-w-full overflow-hidden">
        <CameraVideo stream={stream} className={cn("size-full object-cover transition-[filter]", dim && "brightness-[0.7]")} />
        <svg viewBox="0 0 90 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <ellipse cx="45" cy="77" rx="40" ry="52" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.35" strokeDasharray="1.6 1.6" />
        </svg>
        {children}
      </div>
      <div className="absolute top-16 left-1/2 w-[min(640px,calc(100%-24px))] -translate-x-1/2 rounded-[16px] bg-stone-900/78 px-5 py-4 text-center sm:top-3 sm:w-[min(640px,calc(100%-160px))] sm:px-7">
        {script}
      </div>
      <div className="absolute top-3 right-3 flex items-center gap-2.5 sm:right-4">{corner}</div>
      {bottom && <div className="absolute bottom-6 left-1/2 -translate-x-1/2">{bottom}</div>}
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
