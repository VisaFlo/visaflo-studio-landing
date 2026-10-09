"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Camera, CameraOff, Mic, Play, Square, Sun, TriangleAlert } from "lucide-react"

import { CameraVideo, FaceRing } from "@/components/studio/face-ring"
import { DoneMark, FlowTitle, MonoLabel, PrimaryButton, QuietButton } from "@/components/studio/ui"
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

const CAPTURE_STEPS = ["Fit your face", "Turn your head", "Read the script"]

// The three parts of the recording, named, so it's clear what comes next.
export function CaptureStepper({ current, progress = 0 }: { current: number; progress?: number }) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 gap-1 p-0" aria-label="Recording steps">
      {CAPTURE_STEPS.map((label, i) => (
        <li key={label} aria-current={i === current ? "step" : undefined} className="flex flex-col gap-2">
          <span className="relative h-1 overflow-hidden bg-stone-200">
            <span
              className="absolute inset-y-0 left-0 bg-stone-950 transition-[width] duration-300"
              style={{ width: i < current ? "100%" : i === current ? `${Math.max(8, Math.round(progress * 100))}%` : "0%" }}
            />
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-[12px] leading-tight sm:text-[13px]",
              i === current ? "font-medium text-stone-950" : i < current ? "text-stone-600" : "text-stone-400",
            )}
          >
            {i < current && <DoneMark className="size-3.5 shrink-0" />}
            {label}
          </span>
        </li>
      ))}
    </ol>
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
          <MonoLabel>Before you start</MonoLabel>
          <FlowTitle>Allow camera and mic</FlowTitle>
          <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
            Your browser will ask next. Choose <span className="font-medium text-stone-950">Allow</span>. We use
            them only to make your videos.
          </p>
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

const COUNTDOWN_SECONDS = 3

export function AlignStep({ stream, onStart }: { stream: MediaStream; onStart: (baseline: Pose) => void }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [check, setCheck] = useState<AlignCheck | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [canSkip, setCanSkip] = useState(false)
  const poses = useRef<Pose[]>([])
  const allOkSince = useRef<number | null>(null)
  const faceOkSince = useRef<number | null>(null)
  const readySince = useRef<number | null>(null)
  const started = useRef(false)
  const startRef = useRef<() => void>(() => {})

  const status = useFaceFrames(video, (frame) => {
    if (started.current) return
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
    const ready = Boolean(
      (allOkSince.current && now - allOkSince.current > 400) ||
        (faceOkSince.current && now - faceOkSince.current > 8000),
    )
    // Like Face ID: once everything checks out, count down and start on our
    // own. Moving out of frame cancels the countdown.
    if (!ready) {
      readySince.current = null
      setCountdown(null)
      return
    }
    readySince.current ??= now
    const left = COUNTDOWN_SECONDS - Math.floor((now - readySince.current) / 1000)
    if (left <= 0) startRef.current()
    else setCountdown(left)
  })

  // Glasses, odd light or a slow phone can keep the checks from passing.
  // After 25 seconds, let the person carry on anyway.
  useEffect(() => {
    const id = window.setTimeout(() => setCanSkip(true), 25_000)
    return () => window.clearTimeout(id)
  }, [])

  const unavailable = status === "unavailable"
  const live = status === "ready"
  const aligned = Boolean(check?.inCircle && check.distance === "ok")

  function start() {
    if (started.current) return
    started.current = true
    const list = poses.current
    const baseline = list.length
      ? {
          yaw: list.reduce((s, p) => s + p.yaw, 0) / list.length,
          pitch: list.reduce((s, p) => s + p.pitch, 0) / list.length,
        }
      : { yaw: 0, pitch: 0 }
    onStart(baseline)
  }

  useEffect(() => {
    startRef.current = start
  })

  return (
    <StageLayout
      title={
        <>
          <CaptureStepper current={0} />
          <FlowTitle>Fit your face in the circle</FlowTitle>
          <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
            {unavailable
              ? "Sit about an arm's length away, facing a window or lamp. Press the button when you're centered."
              : "Sit about an arm's length away. When all three are checked, the head turn starts on its own."}
          </p>
        </>
      }
      stage={
        <RingStage>
          <FaceRing stream={stream} onVideo={setVideo} dim={live && !aligned && countdown === null}>
            {countdown !== null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white" aria-hidden>
                <span className="font-serif text-[96px] leading-none font-light drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
                  {countdown}
                </span>
                <span className="bg-stone-950/60 px-3 py-1 text-[14px]">Hold still</span>
              </div>
            )}
          </FaceRing>
        </RingStage>
      }
    >
      {!unavailable && (
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
      <p role="status" className="m-0 text-[14px] text-stone-600">
        {countdown !== null
          ? `Starting the head turn in ${countdown}…`
          : live
            ? aligned
              ? "Almost there. Find a bit more light."
              : "Adjust until all three are checked."
            : status === "loading"
              ? "Starting the face check…"
              : ""}
      </p>
      {(unavailable || canSkip) && (
        <div className="flex flex-col gap-2">
          {unavailable ? (
            <PrimaryButton type="button" onClick={start}>
              I&apos;m centered, start
            </PrimaryButton>
          ) : (
            <QuietButton type="button" onClick={start}>
              The check isn&apos;t finding me. Start anyway
            </QuietButton>
          )}
        </div>
      )}
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
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

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

  // Full ring: show the success state for a beat, then go to the script.
  useEffect(() => {
    if (!complete) return
    const id = window.setTimeout(
      () => doneRef.current({ headTurn: true, faceSeen: faceSeen.current || status !== "ready" }),
      1200,
    )
    return () => window.clearTimeout(id)
  }, [complete, status])

  return (
    <StageLayout
      title={
        <>
          <CaptureStepper current={1} progress={progress} />
          <FlowTitle>{complete ? "Got it" : "Slowly turn your head in a circle"}</FlowTitle>
          <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
            {complete
              ? "Next, read a short script out loud."
              : "Like drawing a circle with your nose. Follow the dot and fill the whole ring."}
          </p>
        </>
      }
      stage={
        <RingStage>
          <FaceRing stream={stream} onVideo={setVideo} done={ticks}>
            {!complete && (
              <div className="pointer-events-none absolute inset-0 animate-spin [animation-duration:7s]" aria-hidden>
                <span className="absolute top-[1.2%] left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#4d5a48] ring-4 ring-white" />
              </div>
            )}
            <span className="absolute top-[9%] left-1/2 flex h-7 -translate-x-1/2 items-center gap-2 bg-stone-950/72 px-2.5 font-mono text-[12px] text-white">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              Recording
            </span>
            {complete && (
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                <span className="flex size-20 items-center justify-center rounded-full bg-white/92">
                  <DoneMark className="size-10" />
                </span>
              </span>
            )}
          </FaceRing>
        </RingStage>
      }
    >
      <div className="flex items-baseline gap-3">
        <p role="status" className="m-0 font-mono text-[24px]">
          {Math.round(progress * 100)}%
        </p>
        <span className="text-[14px] text-stone-600">{complete ? "Done" : "of the ring filled"}</span>
      </div>
      <div className="flex flex-col gap-2">
        {canSkip && !complete && (
          <PrimaryButton
            type="button"
            onClick={() => onDone({ headTurn: false, faceSeen: faceSeen.current || status !== "ready" })}
          >
            Skip to the script
          </PrimaryButton>
        )}
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

function MicLevel({ level }: { level: number }) {
  const bars = [0.15, 0.35, 0.55, 0.75]
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden>
      {bars.map((at, i) => (
        <span
          key={i}
          className={cn("w-1 transition-colors", level > at ? "bg-[#4d5a48]" : "bg-stone-300")}
          style={{ height: `${(i + 1) * 25}%` }}
        />
      ))}
    </span>
  )
}

const MS_PER_WORD = 330

export function ScriptStep({
  stream,
  lines,
  speaking,
  level,
  onStop,
  onRestart,
}: {
  stream: MediaStream
  lines: string[]
  /** Whether the person is talking right now; null when the mic can't be read. */
  speaking: () => boolean | null
  level: () => number
  onStop: () => void
  onRestart: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [line, setLine] = useState(0)
  const [mic, setMic] = useState(0)
  const [heard, setHeard] = useState(false)
  const [deaf, setDeaf] = useState(false)
  const lineRef = useRef(0)
  const stopped = useRef(false)
  // Kept in refs so a parent re-render (new function identities) doesn't
  // restart the prompter clock.
  const stopRef = useRef(onStop)
  const speakingRef = useRef(speaking)
  const levelRef = useRef(level)
  useEffect(() => {
    stopRef.current = onStop
    speakingRef.current = speaking
    levelRef.current = level
  })

  const go = (next: number) => {
    lineRef.current = Math.max(0, Math.min(lines.length - 1, next))
    setLine(lineRef.current)
  }
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })

  // The prompter follows the voice: a line moves on once the person has
  // spoken about as long as it takes to say it and then pauses (or keeps
  // going well past it). Audio never leaves the browser. If the mic can't be
  // read, it falls back to a steady reading pace.
  useEffect(() => {
    const startedAt = performance.now()
    let spokenMs = 0
    let silentMs = 0
    let lineMs = 0
    let lastLine = 0
    let everHeard = false
    const id = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000
      setElapsed(seconds)
      setMic(levelRef.current())
      if (lineRef.current !== lastLine) {
        lastLine = lineRef.current
        spokenMs = silentMs = lineMs = 0
      }
      const current = lineRef.current
      if (current < lines.length - 1) {
        let talking = speakingRef.current()
        lineMs += 100
        // Nothing heard in 8 seconds: likely a quiet or muted mic. Keep the
        // prompter moving at a steady pace instead of waiting forever.
        if (talking !== null && !everHeard && seconds > 8) {
          setDeaf(true)
          talking = null
        }
        if (talking === null) {
          if (lineMs / 1000 > lineSeconds(lines[current])) goRef.current(current + 1)
        } else {
          if (talking) {
            spokenMs += 100
            silentMs = 0
            everHeard = true
            setHeard(true)
          } else {
            silentMs += 100
          }
          const expected = lines[current].split(/\s+/).length * MS_PER_WORD
          if ((spokenMs >= expected * 0.6 && silentMs >= 350) || spokenMs >= expected * 1.5) {
            goRef.current(current + 1)
          }
        }
      }
      if (seconds >= MAX_SECONDS && !stopped.current) {
        stopped.current = true
        stopRef.current()
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [lines])

  // Keyboard backup for when the prompter gets ahead or behind.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault()
        goRef.current(lineRef.current + 1)
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault()
        goRef.current(lineRef.current - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const finish = () => {
    if (stopped.current) return
    stopped.current = true
    onStop()
  }

  const atEnd = line === lines.length - 1
  const visible = [line - 1, line, line + 1, line + 2].filter((i) => i >= 0 && i < lines.length)

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-grow flex-col gap-6 px-(--page-pad) py-6 sm:gap-8 sm:py-10">
      <CaptureStepper current={2} progress={(line + 1) / lines.length} />
      <div className="order-2 flex flex-col gap-5 sm:order-1">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[14px] text-stone-600">
          <span className="flex items-center gap-2">
            <Mic className="size-4" strokeWidth={1.8} aria-hidden />
            <MicLevel level={mic} />
            <span className={cn(deaf && !heard && "text-[#c2410c]")}>
              {deaf && !heard
                ? "We can't hear you. Check your mic is on and not muted. The script moves at a steady pace for now."
                : heard
                  ? "Read out loud. The script follows your voice."
                  : "Start reading out loud. The script follows your voice."}
            </span>
          </span>
          <span className="font-mono text-[12px] tracking-[0.1em] uppercase">
            Line {line + 1} of {lines.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => go(line + 1)}
          aria-label={`Script line ${line + 1} of ${lines.length}: ${lines[line]}. Tap to skip ahead.`}
          className="flex flex-col gap-4 text-center font-serif text-[24px] leading-[1.3] tracking-[-0.01em] sm:text-[32px]"
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
        </button>
        <p className="m-0 text-center text-[13px] text-stone-500">
          {atEnd
            ? "That's the last line. Press Finish recording when you're done."
            : "Ahead or behind? Tap the script or press Space to skip a line."}
        </p>
      </div>
      <div className="order-1 flex flex-wrap items-center justify-between gap-4 border-stone-200 sm:order-2 sm:mt-auto sm:gap-6 sm:border-t sm:pt-6">
        <div className="relative aspect-[16/10] w-[min(240px,40vw)] overflow-hidden bg-stone-700 sm:w-[288px]">
          <CameraVideo stream={stream} className="size-full object-cover" />
          <span className="absolute top-2 left-2 flex h-6 items-center gap-2 bg-stone-950/72 px-2 font-mono text-[12px] text-white">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            {clock(elapsed)} / {clock(TARGET_SECONDS)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-6">
          <QuietButton type="button" onClick={onRestart}>
            Start over
          </QuietButton>
          <button
            type="button"
            onClick={finish}
            className={cn(
              "flex h-[52px] items-center gap-3 border px-5 text-[16px] font-medium transition-colors",
              atEnd ? "border-stone-950 bg-stone-950 text-white hover:bg-stone-800" : "border-stone-950/16 hover:border-stone-950",
            )}
          >
            <Square className="size-4 fill-red-500 text-red-500" aria-hidden />
            Finish recording
          </button>
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
  error,
  notice,
  onConsent,
  onSubmit,
  onRedo,
}: {
  recording: Recording
  consent: boolean
  error?: string | null
  /** Shown above the checks, e.g. for a take recovered after a reload. */
  notice?: string | null
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
          className={cn("size-full object-cover", recording.source === "camera" && !playing && "-scale-x-100")}
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
        <FlowTitle>{allGood && !notice ? "Looks good" : "Take a look"}</FlowTitle>
        {notice && (
          <p className="m-0 flex items-start gap-2 bg-stone-50 p-3 text-[14px] leading-[1.5] text-stone-700">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#c2410c]" aria-hidden />
            {notice}
          </p>
        )}
        {checks ? (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            <Chip ok={checks.faceSeen}>{checks.faceSeen ? "Face clear" : "Face not seen"}</Chip>
            <Chip ok={checks.voiceHeard}>{checks.voiceHeard ? "Voice clear" : "No voice heard"}</Chip>
            <Chip ok={checks.headTurn}>{checks.headTurn ? "Head turn" : "Head turn skipped"}</Chip>
            {short && <Chip ok={false}>Short. Aim for a minute</Chip>}
          </ul>
        ) : notice ? null : (
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
        {error && (
          <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[#c2410c]">
            {error}
          </p>
        )}
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
