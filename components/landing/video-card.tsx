"use client"

import * as React from "react"

import type { Sample } from "@/components/landing/samples"

function SampleVideo({
  sample,
  startAt,
  sound,
}: {
  sample: Sample
  startAt: number
  /** True while the viewer hovers the card: restart and play with audio. */
  sound: boolean
}) {
  const ref = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = ref.current
    if (!video) return

    // Repeated copies start at different points so two cards showing the same
    // sample are never on the same frame.
    video.currentTime = startAt

    // With reduced motion nothing autoplays; the viewer starts it themselves.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.controls = true
      return
    }

    // The marquee holds many copies of each sample, so only the cards on
    // screen play. Everything else stays paused on its poster.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // A blocked autoplay (e.g. low power mode) leaves the poster showing.
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { rootMargin: "0px 160px" }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [startAt])

  React.useEffect(() => {
    const video = ref.current
    if (!video) return
    if (!sound) {
      video.muted = true
      return
    }
    video.currentTime = 0
    video.muted = false
    // Browsers only allow audio after the viewer has clicked or tapped the
    // page. Until then the hover keeps playing silently.
    video.play().catch(() => {
      video.muted = true
      video.play().catch(() => {})
    })
  }, [sound])

  return (
    <video
      ref={ref}
      src={sample.videoSrc}
      poster={sample.poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={sample.title}
      className="absolute inset-0 size-full object-cover"
    />
  )
}

function VideoCard({
  sample,
  startAt = 0,
  hidden = false,
}: {
  sample: Sample
  /** Seconds into the video where this copy starts playing. */
  startAt?: number
  /** Marks the repeated marquee copies so assistive tech reads each card once. */
  hidden?: boolean
}) {
  const [sound, setSound] = React.useState(false)

  return (
    <div
      aria-hidden={hidden || undefined}
      // The gap is padding, not margin, so moving across it keeps the card hovered.
      className="box-content w-[clamp(230px,22vw,290px)] flex-none pr-4 transition-opacity duration-300"
      onPointerEnter={() => setSound(true)}
      onPointerLeave={() => setSound(false)}
      // A click supplies the user activation browsers require for audio.
      onClick={() => setSound(true)}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-[6px] border border-stone-950/8 bg-[repeating-linear-gradient(135deg,#f5f5f4_0_12px,#eeedeb_12px_24px)]">
        {sample.videoSrc ? (
          <SampleVideo sample={sample} startAt={startAt} sound={sound} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-mono text-[11px] text-stone-400">
            sample video · 9:16
          </div>
        )}
      </div>
      {/* The videos carry their own captions and graphics, so the tag and
          duration sit under the frame instead of on top of it. */}
      <div className="mt-[14px] flex justify-between font-mono text-[11px] tracking-[0.06em] text-stone-600">
        <span>{sample.tag}</span>
        <span>{sample.duration}</span>
      </div>
      <div className="mt-1.5 text-[15px] leading-[1.35]">{sample.title}</div>
    </div>
  )
}

export { VideoCard }
