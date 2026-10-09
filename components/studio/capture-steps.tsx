"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Camera, CameraOff, Mic, Play, Sun, TriangleAlert } from "lucide-react"

import { CameraVideo, FaceRing } from "@/components/studio/face-ring"
import { DoneMark, FlowTitle, MonoLabel, PrimaryButton, QuietButton, StepBars } from "@/components/studio/ui"
import { CONSENT_TEXT, lineSeconds, MAX_SECONDS, TARGET_SECONDS } from "@/lib/studio/content"
import { checkAlignment, RING_TICKS, ticksForPose, type AlignCheck } from "@/lib/studio/face-tracker"
import type { Recording } from "@/lib/studio/recorder"
import { useFaceFrames } from "@/lib/studio/use-face-frames"
import { cn } from "@/lib/utils"

export type Pose = { yaw: number; pitch: number }

// Camera steps: the preview takes the big left area on desktop and sits
// between the title and the controls on a phone.
function StageLayout({ title, stage, children }: { title: ReactNode; stage: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-[1280px] flex-grow content-center gap-6 px-(--page-pad) py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:gap-x-12 lg:gap-y-6 lg:py-12">
      <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:self-end">{title}</div>
      <div className="flex min-w-0 items-center justify-center lg:col-start-1 lg:row-span-2 lg:row-start-1">{stage}</div>
      <div className="flex flex-col gap-6 lg:col-start-2 lg:self-start">{children}</div>
    </main>
  )
}

function RingStage({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center justify-center bg-stone-100 py-6 sm:py-8 lg:h-[560px]">{children}</div>
  )
}

export function CameraAllowStep({
  unsupported,
  error,
  busy,
  onAllow,
  onUpload,
}: {
  unsupported: boolean
  error: string | null
  busy: boolean
  onAllow: () => void
  onUpload: () => void
}) {
  return (
    <StageLayout
      title={
        <>
          <MonoLabel>Step 1 of 3</MonoLabel>
          <FlowTitle>Allow camera and mic</FlowTitle>
          <p className="m-0 text-[16px] leading-[1.5] text-stone-600">Used only to make your videos.</p>
        </>
      }
      stage={
        <div className="flex aspect-[16/10] max-h-[560px] w-full items-center justify-center gap-6 border-[1.5px] border-dashed border-stone-400 bg-stone-50">
          <Camera className="size-12 text-stone-600" strokeWidth={1.3} />
          <Mic className="size-11 text-stone-600" strokeWidth={1.3} />
        </div>
      }
    >
      {unsupported && (
        <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[#c2410c]">
          This browser can&apos;t record video. Open this page in Chrome or Safari, or upload a video instead.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[#c2410c]">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {!unsupported && (
          <PrimaryButton type="button" onClick={onAllow} disabled={busy}>
            {busy ? "Waiting for your browser…" : "Allow camera and mic"}
          </PrimaryButton>
        )}
        <QuietButton type="button" onClick={onUpload}>
          Upload a video instead
        </QuietButton>
      </div>
    </StageLayout>
  )
}

function blockedSteps(): ReactNode[] {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Edg|Android/.test(ua)
  if (isIos) {
    return [
      <>Tap <span className="font-medium">aA</span> in the address bar</>,
      <>Tap <span className="font-medium">Website Settings</span></>,
      <>Set Camera and Microphone to <span className="font-medium">Allow</span></>,
    ]
  }
  if (isSafari) {
    return [
      <>Open <span className="font-medium">Safari &gt; Settings for This Website</span></>,
      <>Set Camera and Microphone to <span className="font-medium">Allow</span></>,
      <>Close the menu</>,
    ]
  }
  return [
    <span key="1" className="flex items-center gap-2">
      Click
      <span className="inline-flex h-6 w-7 items-center justify-center border border-stone-300">
        <CameraOff className="size-3.5" strokeWidth={1.8} aria-label="camera icon" />
      </span>
      in the address bar
    </span>,
    <>Choose <span className="font-medium">Always allow</span></>,
    <>Click <span className="font-medium">Done</span></>,
  ]
}

export function CameraBlockedStep({ onRetry, onUpload }: { onRetry: () => void; onUpload: () => void }) {
  // Only ever shown after a click, never server-rendered, so reading the
  // user agent here is safe.
  const steps = blockedSteps()
  return (
    <StageLayout
      title={
        <>
          <CameraOff className="size-8 text-[#c2410c]" strokeWidth={1.6} />
          <FlowTitle>Camera is blocked</FlowTitle>
          <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
            Your browser is set to block this site. Turn it on, then try again.
          </p>
        </>
      }
      stage={
        <div className="flex aspect-[16/10] max-h-[560px] w-full items-center justify-center border border-stone-200 bg-stone-100">
          <CameraOff className="size-14 text-stone-400" strokeWidth={1.3} />
        </div>
      }
    >
      <ol className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-4 border-b border-stone-200 py-3 text-[16px]">
            <span className="w-6 font-mono text-[14px] text-stone-600">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <PrimaryButton type="button" onClick={onRetry}>
          Try again
        </PrimaryButton>
        <QuietButton type="button" onClick={onUpload}>
          Upload a video instead
        </QuietButton>
      </div>
    </StageLayout>
  )
}

function CheckRow({ label, ok, hint }: { label: string; ok: boolean | null; hint?: ReactNode }) {
  return (
    <li className="flex items-center justify-between border-b border-stone-200 py-3 text-[16px]">
      <span>{label}</span>
      {ok === null ? (
        <span className="text-[14px] text-stone-500">Checking…</span>
      ) : ok ? (
        <DoneMark />
      ) : (
        <span className="flex items-center gap-2 text-[14px] font-medium text-[#c2410c]">{hint}</span>
      )}
    </li>
  )
}

export function AlignStep({ stream, onStart }: { stream: MediaStream; onStart: (baseline: Pose) => void }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [check, setCheck] = useState<AlignCheck | null>(null)
  const [ready, setReady] = useState(false)
  const poses = useRef<Pose[]>([])
  const allOkSince = useRef<number | null>(null)
  const faceOkSince = useRef<number | null>(null)

  const status = useFaceFrames(video, (frame) => {
    const result = checkAlignment(frame)
    setCheck(result)
    const now = performance.now()
    if (frame.found) {
      poses.current.push({ yaw: frame.yaw, pitch: frame.pitch })
      if (poses.current.length > 15) poses.current.shift()
    }
    const faceOk = Boolean(result?.inCircle && result.distance === "ok")
    faceOkSince.current = faceOk ? (faceOkSince.current ?? now) : null
    allOkSince.current = faceOk && result?.light ? (allOkSince.current ?? now) : null
    // A dim room shouldn't stop anyone: after 8 seconds framed well, light
    // becomes advice rather than a blocker.
    setReady(
      Boolean(
        (allOkSince.current && now - allOkSince.current > 600) ||
          (faceOkSince.current && now - faceOkSince.current > 8000),
      ),
    )
  })

  const unavailable = status === "unavailable"
  const live = status === "ready"
  const aligned = Boolean(check?.inCircle && check.distance === "ok")

  function start() {
    const list = poses.current
    const baseline = list.length
      ? {
          yaw: list.reduce((s, p) => s + p.yaw, 0) / list.length,
          pitch: list.reduce((s, p) => s + p.pitch, 0) / list.length,
        }
      : { yaw: 0, pitch: 0 }
    onStart(baseline)
  }

  return (
    <StageLayout
      title={
        <>
          <StepBars filled={1} />
          <MonoLabel>Step 1 of 3</MonoLabel>
          <FlowTitle>Fit your face in the circle</FlowTitle>
        </>
      }
      stage={
        <RingStage>
          <FaceRing stream={stream} onVideo={setVideo} dim={live && !aligned} />
        </RingStage>
      }
    >
      {unavailable ? (
        <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
          Center your face in the circle, about an arm&apos;s length away, facing a window or lamp.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
          <CheckRow label="Face in circle" ok={live ? Boolean(check?.inCircle) : null} hint="Center your face" />
          <CheckRow
            label="Distance"
            ok={live ? check?.distance === "ok" : null}
            hint={check?.distance === "back" ? "Move back a little" : "Move closer"}
          />
          <CheckRow
            label="Light"
            ok={live ? Boolean(check?.light) : null}
            hint={
              <>
                <Sun className="size-4" strokeWidth={2} aria-hidden />
                Face a window
              </>
            }
          />
        </ul>
      )}
      <PrimaryButton type="button" disabled={!(ready || unavailable)} onClick={start}>
        Start head turn
      </PrimaryButton>
    </StageLayout>
  )
}

export function TurnStep({
  stream,
  baseline,
  onDone,
  onStartOver,
}: {
  stream: MediaStream
  baseline: Pose
  onDone: (result: { headTurn: boolean; faceSeen: boolean }) => void
  onStartOver: () => void
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [ticks, setTicks] = useState<Set<number>>(() => new Set())
  const [canSkip, setCanSkip] = useState(false)
  const faceSeen = useRef(false)

  const status = useFaceFrames(video, (frame) => {
    if (!frame.found) return
    faceSeen.current = true
    const hit = ticksForPose(frame.yaw - baseline.yaw, frame.pitch - baseline.pitch)
    if (!hit.length) return
    setTicks((prev) => {
      if (hit.every((t) => prev.has(t))) return prev
      const next = new Set(prev)
      hit.forEach((t) => next.add(t))
      return next
    })
  })

  // Without live tracking, fill the ring over 12 seconds so the person still
  // has a pace to follow; the recording captures the turn either way.
  useEffect(() => {
    if (status !== "unavailable") return
    const start = performance.now()
    const id = window.setInterval(() => {
      const n = Math.min(RING_TICKS, Math.round(((performance.now() - start) / 12_000) * RING_TICKS))
      setTicks(new Set(Array.from({ length: n }, (_, i) => i)))
    }, 100)
    return () => window.clearInterval(id)
  }, [status])

  // If tracking struggles (glasses, odd light), let them move on after 30s.
  useEffect(() => {
    const id = window.setTimeout(() => setCanSkip(true), 30_000)
    return () => window.clearTimeout(id)
  }, [])

  const progress = ticks.size / RING_TICKS
  const complete = progress >= 0.8

  return (
    <StageLayout
      title={
        <>
          <StepBars filled={1} partial={Math.max(progress, 0.02)} />
          <MonoLabel>Step 2 of 3</MonoLabel>
          <FlowTitle>{complete ? "Nice, that's the turn" : "Slowly move your head in a circle"}</FlowTitle>
        </>
      }
      stage={
        <RingStage>
          <FaceRing stream={stream} onVideo={setVideo} done={ticks} />
        </RingStage>
      }
    >
      <p role="status" className="m-0 font-mono text-[24px]">
        {Math.round(progress * 100)}%
      </p>
      <div className="flex flex-col gap-2">
        <PrimaryButton
          type="button"
          disabled={!complete && !canSkip}
          onClick={() => onDone({ headTurn: complete, faceSeen: faceSeen.current || status !== "ready" })}
        >
          {complete || !canSkip ? "Continue" : "Skip the head turn"}
        </PrimaryButton>
        <QuietButton type="button" onClick={onStartOver}>
          Start over
        </QuietButton>
      </div>
    </StageLayout>
  )
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function ScriptStep({
  stream,
  lines,
  onStop,
  onRestart,
}: {
  stream: MediaStream
  lines: string[]
  onStop: () => void
  onRestart: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [line, setLine] = useState(0)
  const startedAt = useRef(0)
  const lineStartedAt = useRef(0)
  const stopped = useRef(false)

  useEffect(() => {
    startedAt.current = performance.now()
    lineStartedAt.current = startedAt.current
    const id = window.setInterval(() => {
      const now = performance.now()
      const seconds = (now - startedAt.current) / 1000
      setElapsed(seconds)
      setLine((current) => {
        if (current < lines.length - 1 && (now - lineStartedAt.current) / 1000 > lineSeconds(lines[current])) {
          lineStartedAt.current = now
          return current + 1
        }
        return current
      })
      if (seconds >= MAX_SECONDS && !stopped.current) {
        stopped.current = true
        onStop()
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [lines, onStop])

  // Reading faster than the prompter? Tap the script to move on.
  function advance() {
    lineStartedAt.current = performance.now()
    setLine((current) => Math.min(lines.length - 1, current + 1))
  }

  const visible = [line - 1, line, line + 1, line + 2].filter((i) => i >= 0 && i < lines.length)

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-grow flex-col gap-6 px-(--page-pad) py-6 sm:gap-10 sm:py-10">
      <StepBars filled={2} partial={Math.min(1, elapsed / TARGET_SECONDS)} />
      <button
        type="button"
        onClick={advance}
        aria-label="Script. Tap to go to the next line."
        className="order-2 flex flex-col gap-4 text-center font-serif text-[24px] leading-[1.3] tracking-[-0.01em] sm:order-1 sm:text-[32px]"
      >
        {visible.map((i) => (
          <p
            key={i}
            className={cn(
              "m-0 transition-colors",
              i < line && "text-stone-400",
              i === line && "text-stone-950",
              i > line && "text-stone-600",
            )}
          >
            {i === line ? <span className="bg-[#eef0e9] shadow-[0_0_0_6px_#eef0e9]">{lines[i]}</span> : lines[i]}
          </p>
        ))}
        {line === lines.length - 1 && (
          <p className="m-0 font-sans text-[14px] text-stone-600">That&apos;s the end. Tap stop when you finish.</p>
        )}
      </button>
      <div className="order-1 flex flex-wrap items-center justify-between gap-6 border-stone-200 sm:order-2 sm:mt-auto sm:border-t sm:pt-6">
        <div className="relative aspect-[16/10] w-[min(288px,45vw)] overflow-hidden bg-stone-700">
          <CameraVideo stream={stream} className="size-full object-cover" />
          <span className="absolute top-2 left-2 flex h-6 items-center gap-2 bg-stone-950/72 px-2 font-mono text-[12px] text-white">
            <span className="size-2 rounded-full bg-red-500" />
            {clock(elapsed)} / {clock(TARGET_SECONDS)}
          </span>
        </div>
        <button
          type="button"
          aria-label="Stop recording"
          onClick={() => {
            if (stopped.current) return
            stopped.current = true
            onStop()
          }}
          className="flex size-[72px] items-center justify-center rounded-full border-4 border-stone-950"
        >
          <span className="size-6 rounded-[4px] bg-red-500" />
        </button>
        <div className="flex justify-end sm:w-[288px]">
          <QuietButton type="button" onClick={onRestart}>
            Restart
          </QuietButton>
        </div>
      </div>
    </main>
  )
}

function Chip({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li
      className={cn(
        "flex h-8 items-center gap-2 px-3 text-[14px]",
        ok ? "bg-[#eef0e9] text-[#3a4536]" : "bg-orange-50 text-[#c2410c]",
      )}
    >
      {ok ? <DoneMark className="size-3.5 stroke-[#3a4536]" /> : <TriangleAlert className="size-3.5" aria-hidden />}
      {children}
    </li>
  )
}

export function ReviewStep({
  recording,
  consent,
  onConsent,
  onSubmit,
  onRedo,
}: {
  recording: Recording
  consent: boolean
  onConsent: (value: boolean) => void
  onSubmit: () => void
  onRedo: () => void
}) {
  const player = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const checks = recording.checks
  const short = recording.source === "camera" && recording.seconds < 45
  const allGood = !checks || (checks.faceSeen && checks.voiceHeard && checks.headTurn && !short)

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-grow flex-wrap items-center gap-8 px-(--page-pad) py-6 sm:gap-12 sm:py-12">
      <div className="relative aspect-[16/10] max-h-[560px] min-w-0 flex-[999_1_560px] overflow-hidden bg-stone-700">
        <video
          ref={player}
          src={recording.url}
          playsInline
          controls={playing}
          onPlay={() => setPlaying(true)}
          className={cn("size-full object-cover", recording.source === "camera" && "-scale-x-100")}
        />
        {!playing && (
          <button
            type="button"
            aria-label="Play recording"
            onClick={() => void player.current?.play()}
            className="absolute top-1/2 left-1/2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92"
          >
            <Play className="size-7 translate-x-0.5 fill-stone-950 text-stone-950" aria-hidden />
          </button>
        )}
        {!playing && recording.seconds > 0 && (
          <span className="absolute right-4 bottom-4 flex h-6 items-center bg-stone-950/72 px-2 font-mono text-[12px] text-white">
            {clock(recording.seconds)}
          </span>
        )}
      </div>
      <div className="flex flex-[1_1_320px] flex-col gap-6">
        <FlowTitle>{allGood ? "Looks good" : "Take a look"}</FlowTitle>
        {checks ? (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            <Chip ok={checks.faceSeen}>{checks.faceSeen ? "Face clear" : "Face not seen"}</Chip>
            <Chip ok={checks.voiceHeard}>{checks.voiceHeard ? "Voice clear" : "No voice heard"}</Chip>
            <Chip ok={checks.headTurn}>{checks.headTurn ? "Head turn" : "Head turn skipped"}</Chip>
            {short && <Chip ok={false}>Short. Aim for a minute</Chip>}
          </ul>
        ) : (
          <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
            Use a clip where you face the camera and talk for about a minute in a quiet room.
          </p>
        )}
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 border p-4 text-[14px] leading-[1.5]",
            consent ? "border-stone-950" : "border-stone-200",
          )}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => onConsent(e.target.checked)}
            className="m-0 size-5 shrink-0 accent-stone-950"
          />
          <span>{CONSENT_TEXT}</span>
        </label>
        <div className="flex flex-col gap-2">
          <PrimaryButton type="button" disabled={!consent} onClick={onSubmit}>
            Submit recording
          </PrimaryButton>
          <QuietButton type="button" onClick={onRedo}>
            {recording.source === "camera" ? "Record again" : "Choose another video"}
          </QuietButton>
        </div>
      </div>
    </main>
  )
}
