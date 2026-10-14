"use client"

import { useRef, useState } from "react"
import { Play } from "lucide-react"

/** The finished video in an iPhone frame, with a play button and a progress bar. */
export function PhonePreview({ videoSrc, poster, duration }: { videoSrc: string; poster: string; duration: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState(0)

  return (
    <div className="relative my-3 h-[650px] w-[300px] overflow-hidden rounded-[46px] bg-black shadow-[0_0_0_11px_#1c1917,0_0_0_12px_#78716c,0_24px_48px_rgba(28,25,23,0.25)]">
      <video
        ref={video}
        src={videoSrc}
        poster={poster}
        playsInline
        preload="auto"
        onClick={() => video.current?.pause()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          setPlayed(v.duration ? v.currentTime / v.duration : 0)
        }}
        className="absolute inset-0 size-full bg-black object-cover"
      />
      {!playing && (
        <button
          type="button"
          onClick={() => void video.current?.play()}
          aria-label="Play video"
          className="absolute top-1/2 left-1/2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-stone-950"
        >
          <Play className="ml-1 size-[26px]" fill="currentColor" strokeWidth={0} />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-[14px] bottom-[22px] flex items-center gap-2.5 font-mono text-[10px] text-white">
        <div className="h-[3px] flex-1 bg-white/35">
          <div className="h-[3px] bg-white" style={{ width: `${played * 100}%` }} />
        </div>
        <span>{duration}</span>
      </div>

      <div aria-hidden="true" className="absolute top-[11px] left-1/2 z-10 h-[30px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
      <div aria-hidden="true" className="absolute bottom-2 left-1/2 z-10 h-1 w-[112px] -translate-x-1/2 rounded-full bg-white/75" />
    </div>
  )
}
