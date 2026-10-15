"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Camera, CameraOff, Mic, Play, Square, TriangleAlert, X } from "lucide-react"

import {
  CameraVideo,
  FullScreenStage,
  PreviewBadge,
  ShotButton,
  ShotFrame,
  ShotLayout,
  StatusPill,
} from "@/components/studio/camera-frame"
import { FlowTitle, MonoLabel, PrimaryButton, QuietButton } from "@/components/studio/ui"
import { CONSENT_TEXT, lineSeconds, MAX_SECONDS, TARGET_SECONDS } from "@/lib/studio/content"
import type { Check } from "@/lib/studio/checks"
import { checkAlignment, type AlignCheck, type FaceFrame } from "@/lib/studio/face-tracker"
import type { Photo } from "@/lib/studio/photo"
import type { Recording } from "@/lib/studio/recorder"
import { startRecognizer, speechRecognitionSupported } from "@/lib/studio/speech-recognizer"
import { useFaceFrames } from "@/lib/studio/use-face-frames"
import { advancePointer, indexScript, lineOfWord, tokenize } from "@/lib/studio/word-follow"
import { cn } from "@/lib/utils"

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

export function CameraAllowStep({
  unsupported,
  error,
  busy,
  onAllow,
}: {
  unsupported: boolean
  error: string | null
  busy: boolean
  onAllow: () => void
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
        <div className="flex aspect-[9/16] h-[min(560px,60vh)] flex-col items-center justify-center gap-6 rounded-[28px] border-[1.5px] border-dashed border-stone-400 bg-stone-50">
          <Camera className="size-12 text-stone-600" strokeWidth={1.3} />
          <Mic className="size-11 text-stone-600" strokeWidth={1.3} />
        </div>
      }
    >
      {unsupported && (
        <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[#c2410c]">
          This browser can&apos;t record video. Open this page in Chrome or Safari, or on your phone.
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
      </div>
      <PhoneHint />
    </StageLayout>
  )
}

// Without a file-upload fallback, the way out of a missing or blocked camera
// is the phone: the same link works there, no account needed.
function PhoneHint() {
  return (
    <p className="m-0 text-[14px] leading-[1.5] text-stone-600">
      No camera on this computer? Open <span className="font-medium text-stone-950">studio.visaflo.ca/start</span> on your
      phone instead.
    </p>
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

export function CameraBlockedStep({ onRetry }: { onRetry: () => void }) {
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
        <div className="flex aspect-[9/16] h-[min(560px,60vh)] items-center justify-center rounded-[28px] border border-stone-200 bg-stone-100">
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
      </div>
      <PhoneHint />
    </StageLayout>
  )
}

const COUNTDOWN_SECONDS = 3

// Keeps the face detector running, off-screen, while the script is read, so
// the review and the team can tell whether a face was in the camera's view
// while recording. It is a found/not-found tally on the raw camera frame
// (wider than the recorded crop on a laptop), not the framing check. The flow
// tallies the readings; with fewer than FACE_MIN_FRAMES of them the framing
// step's own reading stands (checks.ts).
export function FaceWatch({ camera, onFrame }: { camera: MediaStream; onFrame: (frame: FaceFrame) => void }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  useFaceFrames(video, onFrame)
  return <CameraVideo stream={camera} onVideo={setVideo} className="pointer-events-none absolute size-px opacity-0" />
}

// `stream` is the vertical crop the person sees and records; `camera` is the
// raw camera it was cut from. The face check reads the raw camera, not
// `stream`: MediaPipe's detectForVideo threw on the canvas-captured stream
// (Chrome on macOS, @mediapipe/tasks-vision 1.1; see commit c5270eb). If a
// later version accepts it, this indirection can go. readFace measures
// inside the same 9:16 crop, so the check matches the preview.
//
// The camera screen before the portrait photo and before the video, like
// HeyGen's: the big vertical preview, one pill saying what to fix (or that
// all is set), and two small buttons right under it. The check never blocks:
// it advises, and its reading travels with the take. For the video, Start
// recording opens the full-screen countdown (CountdownStep).
export function AlignStep({
  stream,
  camera,
  purpose,
  onStart,
  onCancel,
  onTips,
}: {
  stream: MediaStream
  camera: MediaStream
  purpose: "photo" | "video"
  /**
   * faceSeen is null when the tracker never ran, so nothing is claimed.
   * `preview` is the vertical preview's video, for the photo to be taken from.
   */
  onStart: (result: { faceSeen: Check; preview: HTMLVideoElement | null }) => void
  onCancel: () => void
  /** Back to the guidelines for this capture. */
  onTips: () => void
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [check, setCheck] = useState<AlignCheck | null>(null)
  const faceSeen = useRef(false)
  const preview = useRef<HTMLVideoElement | null>(null)
  const onPreview = useCallback((el: HTMLVideoElement | null) => {
    preview.current = el
  }, [])
  const photo = purpose === "photo"

  const status = useFaceFrames(video, (frame) => {
    if (frame.found) faceSeen.current = true
    setCheck(checkAlignment(frame))
  })

  const live = status === "ready"
  const allSet = live && Boolean(check?.inFrame && check.distance === "ok" && check.light)
  // One thing to fix at a time, the way it is easiest to act on.
  const pill: { text: string; ok: boolean } | null = !live
    ? status === "loading"
      ? { text: "Checking your camera…", ok: false }
      : null
    : allSet
      ? { text: "You're all set", ok: true }
      : !check?.inFrame
        ? { text: "Center your face", ok: false }
        : check.distance === "back"
          ? { text: "Move back a little", ok: false }
          : check.distance !== "ok"
            ? { text: "Move closer", ok: false }
            : { text: "Face a window or lamp", ok: false }

  function begin() {
    // Without live tracking there is no reading: "not checked", not "seen".
    onStart({ faceSeen: live ? faceSeen.current : null, preview: preview.current })
  }

  return (
    <ShotLayout
      frame={
        <ShotFrame>
          <CameraVideo stream={camera} onVideo={setVideo} className="pointer-events-none absolute size-px opacity-0" />
          <CameraVideo stream={stream} onVideo={onPreview} className="size-full object-cover" />
          <PreviewBadge />
          {pill && <StatusPill tone={pill.ok ? "ok" : "plain"}>{pill.text}</StatusPill>}
        </ShotFrame>
      }
      buttons={
        <>
          <ShotButton type="button" onClick={onCancel}>
            Cancel
          </ShotButton>
          <ShotButton type="button" primary onClick={begin}>
            {photo ? (
              <>
                <Camera className="size-4" strokeWidth={1.8} aria-hidden />
                Take photo
              </>
            ) : (
              <>
                <span className="size-2.5 rounded-full bg-red-500" aria-hidden />
                Start recording
              </>
            )}
          </ShotButton>
        </>
      }
      below={
        <QuietButton type="button" onClick={onTips}>
          {photo ? "Remind me what a good photo is" : "Video tips"}
        </QuietButton>
      }
    />
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Stop and go back"
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-full bg-stone-900/78 text-white hover:bg-stone-900"
    >
      <X className="size-[18px]" strokeWidth={2} aria-hidden />
    </button>
  )
}

// The three seconds between Start recording and the recording, already full
// screen, with the first line waiting in the script box.
export function CountdownStep({
  stream,
  firstLine,
  onDone,
  onCancel,
}: {
  stream: MediaStream
  firstLine: string
  onDone: () => void
  onCancel: () => void
}) {
  const [left, setLeft] = useState(COUNTDOWN_SECONDS)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })
  useEffect(() => {
    let n = COUNTDOWN_SECONDS
    const id = window.setInterval(() => {
      n -= 1
      if (n > 0) {
        setLeft(n)
        return
      }
      window.clearInterval(id)
      doneRef.current()
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <FullScreenStage
      stream={stream}
      dim
      script={
        <>
          <p className="m-0 text-[20px] leading-[1.4] font-semibold text-white/50 sm:text-[24px]">{firstLine}</p>
          <p className="m-0 mt-2 text-[14px] text-white/70">Speak with energy. Starting…</p>
        </>
      }
      corner={<CloseButton onClick={onCancel} />}
    >
      <div className="absolute inset-0 flex items-center justify-center" aria-live="assertive">
        <span className="font-serif text-[160px] leading-none font-light drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)]">{left}</span>
      </div>
    </FullScreenStage>
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
          className={cn("w-1 transition-colors", level > at ? "bg-[#b9d3a4]" : "bg-white/25")}
          style={{ height: `${(i + 1) * 25}%` }}
        />
      ))}
    </span>
  )
}

const MS_PER_WORD = 330

type FollowMode = "words" | "voice" | "pace"

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
  const script = useMemo(() => indexScript(lines), [lines])
  const [elapsed, setElapsed] = useState(0)
  // Index of the next script word to read, across all lines.
  const [pointer, setPointer] = useState(0)
  const [mic, setMic] = useState(0)
  const [heard, setHeard] = useState(false)
  const [mode, setMode] = useState<FollowMode>(() => (speechRecognitionSupported() ? "words" : "voice"))
  const pointerRef = useRef(0)
  const committedRef = useRef(0)
  const modeRef = useRef(mode)
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
    modeRef.current = mode
  })

  const line = lineOfWord(script, pointer)
  const lineEnd = (i: number) => script.lineStarts[i + 1] ?? script.words.length

  const moveTo = (next: number, commit: boolean) => {
    const clamped = Math.max(0, Math.min(script.words.length, next))
    if (commit) committedRef.current = clamped
    pointerRef.current = clamped
    setPointer(clamped)
  }
  const goLine = (i: number) => moveTo(script.lineStarts[Math.max(0, Math.min(lines.length - 1, i))], true)
  const goLineRef = useRef(goLine)
  useEffect(() => {
    goLineRef.current = goLine
  })

  // Word by word: each finished phrase moves the committed position; the
  // phrase still being spoken moves the highlight ahead of it.
  useEffect(() => {
    if (mode !== "words") return
    const handle = startRecognizer({
      onFinal: (text) => {
        const next = advancePointer(script.words, committedRef.current, tokenize(text))
        committedRef.current = Math.max(committedRef.current, next)
        if (committedRef.current > pointerRef.current) moveTo(committedRef.current, false)
        setHeard(true)
      },
      onInterim: (text) => {
        if (!text) return
        const next = advancePointer(script.words, committedRef.current, tokenize(text))
        if (next > pointerRef.current) moveTo(next, false)
        setHeard(true)
      },
      onFail: () => setMode("voice"),
    })
    if (!handle) {
      const id = window.setTimeout(() => setMode("voice"), 0)
      return () => window.clearTimeout(id)
    }
    return () => handle.stop()
    // moveTo only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, script])

  // Clock, mic meter and line pacing. In "words" mode this only steps in when
  // recognition lags: the last word of a line missed, or a long stretch of
  // speech with no matches. In "voice" mode a line moves on once the person
  // has spoken about as long as it takes to say it and then pauses. If no
  // voice is heard at all, it keeps a steady reading pace.
  useEffect(() => {
    const startedAt = performance.now()
    let spokenMs = 0
    let silentMs = 0
    let lineMs = 0
    let lastLine = -1
    let everHeard = false
    const id = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000
      setElapsed(seconds)
      setMic(levelRef.current())
      const current = lineOfWord(script, pointerRef.current)
      if (current !== lastLine) {
        lastLine = current
        spokenMs = silentMs = lineMs = 0
      }
      lineMs += 100
      const talking = speakingRef.current()
      if (talking) {
        spokenMs += 100
        silentMs = 0
        everHeard = true
        if (modeRef.current !== "words") setHeard(true)
      } else {
        silentMs += 100
      }
      if (talking !== null && !everHeard && seconds > 8 && modeRef.current === "voice") setMode("pace")

      if (current < lines.length - 1) {
        const end = script.lineStarts[current + 1]
        const words = end - script.lineStarts[current]
        const expected = words * MS_PER_WORD
        const m = modeRef.current
        let next = false
        if (m === "words") {
          next =
            (pointerRef.current >= end - 1 && silentMs >= 600) ||
            (spokenMs >= expected * 1.8 && silentMs >= 500)
        } else if (m === "voice" && talking !== null) {
          next = (spokenMs >= expected * 0.6 && silentMs >= 350) || spokenMs >= expected * 1.5
        } else {
          next = lineMs / 1000 > lineSeconds(lines[current])
        }
        if (next) goLineRef.current(current + 1)
      }
      if (seconds >= MAX_SECONDS && !stopped.current) {
        stopped.current = true
        stopRef.current()
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [lines, script])

  // Keyboard backup for when the prompter gets ahead or behind.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Leave Space/arrows alone on other controls (Finish, close), or a
      // single key press would both skip a line and press the button.
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select")) return
      if (target?.closest("button") && !target.closest("[data-script]")) return
      const current = lineOfWord(script, pointerRef.current)
      if (event.key === " " || event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault()
        goLineRef.current(current + 1)
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault()
        goLineRef.current(current - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [script])

  const finish = () => {
    if (stopped.current) return
    stopped.current = true
    onStop()
  }

  const atEnd = line === lines.length - 1
  const lineDone = atEnd && pointer >= lineEnd(line) - 1

  // The current line, word by word: read words bright, the next word
  // underlined, the rest faded.
  const renderCurrent = (i: number) => {
    let wordIndex = script.lineStarts[i]
    return lines[i].split(/\s+/).map((word, n) => {
      const counts = tokenize(word).length > 0
      const index = counts ? wordIndex++ : -1
      const read = mode === "words" ? index >= 0 && index < pointer : true
      const isNext = mode === "words" && index === pointer
      return (
        <span key={n}>
          {n > 0 && " "}
          <span
            className={cn(
              "transition-colors duration-150",
              read ? "text-white" : "text-white/50",
              isNext && "text-white underline decoration-[#b9d3a4] decoration-[3px] underline-offset-[7px]",
            )}
          >
            {word}
          </span>
        </span>
      )
    })
  }

  const hint =
    mode === "pace" && !heard
      ? "We can't hear you. Check your mic is on and not muted. The script moves at a steady pace for now."
      : mode === "words"
        ? "Words light up as you say them."
        : "The script follows your voice."

  return (
    <FullScreenStage
      stream={stream}
      script={
        <>
          <button
            type="button"
            data-script
            onClick={() => goLine(line + 1)}
            aria-label={`Script line ${line + 1} of ${lines.length}: ${lines[line]}. Tap to skip ahead.`}
            className="flex w-full flex-col items-center gap-2 text-white"
          >
            <span className={cn("text-[20px] leading-[1.4] font-semibold sm:text-[24px]", mode !== "words" && "text-white")}>
              {renderCurrent(line)}
            </span>
            {line + 1 < lines.length && (
              <span className="text-[17px] leading-[1.4] font-medium text-white/50 sm:text-[20px]">{lines[line + 1]}</span>
            )}
          </button>
          <span className="mt-2 flex items-center justify-center gap-2 text-[13px] text-white/65">
            <MicLevel level={mic} />
            <span className={cn(mode === "pace" && !heard && "text-orange-300")}>
              {atEnd ? (lineDone ? "That's the end. Press Finish recording." : "Last line. Press Finish recording when you're done.") : hint}
            </span>
          </span>
        </>
      }
      corner={
        <>
          <span className="flex h-8 items-center gap-2 rounded-full bg-stone-900/78 px-3 font-mono text-[13px]">
            <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden />
            {clock(elapsed)}
          </span>
          <CloseButton onClick={onRestart} />
        </>
      }
      bottom={
        <button
          type="button"
          onClick={finish}
          className="flex h-10 items-center gap-2 rounded-full bg-white px-[18px] text-[14px] font-medium text-stone-950 hover:bg-stone-100"
        >
          <Square className="size-2.5 fill-red-500 text-red-500" aria-hidden />
          Finish recording
        </button>
      }
    />
  )
}

/**
 * A word about the take on review (recovered after a reload, or cut off), and
 * whether it is only part of what was recorded, which decides what an
 * unplayable file is taken to mean.
 */
export type ReviewNotice = { text: string; partial: boolean }

/** How long after playback is asked for the review waits for it to get going before saying it hasn't. */
const STALL_MS = 5000

// Why playback hasn't happened since it was asked for: the play() call was
// refused without the element reporting an error (the button must not look
// dead), or nothing played within STALL_MS (a file whose header parses and
// whose data never decodes can fire neither `playing` nor `error`). Transient
// and local; the persisted per-take verdict is `checks.playable`.
type PlaybackProblem = "refused" | "stalled" | null

// The take just recorded, in the same frame as the camera was: play it, agree,
// submit or record again.
export function ReviewStep({
  recording,
  consent,
  error,
  notice,
  onConsent,
  onPlayable,
  onSubmit,
  onRedo,
}: {
  recording: Recording
  consent: boolean
  error?: string | null
  notice?: ReviewNotice | null
  onConsent: (value: boolean) => void
  /**
   * Whether this browser could play the take back (true once playback really
   * runs, false on a load or decode error); the flow keeps it with the checks.
   */
  onPlayable: (playable: boolean) => void
  onSubmit: () => void
  onRedo: () => void
}) {
  const player = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [problem, setProblem] = useState<PlaybackProblem>(null)
  const stallTimer = useRef<number | undefined>(undefined)
  const clearStall = () => window.clearTimeout(stallTimer.current)
  useEffect(() => clearStall, [])
  const checks = recording.checks
  // The flow records the player's "no" in the take's checks (and keeps it),
  // so the take itself says whether it played.
  const unplayable = checks.playable === false
  // The script reads in about TARGET_SECONDS; well under that, it wasn't read through.
  const short = recording.seconds < TARGET_SECONDS * 0.6
  // What the pill says: the first thing worth another take, or that it's
  // fine. A check that never ran isn't a complaint; a recovered take's
  // placeholders aren't readings, so it gets no pill.
  const pill: { text: string; ok: boolean } | null = checks.recovered
    ? null
    : checks.faceSeen === false
      ? { text: "Face not seen", ok: false }
      : checks.voiceHeard === false
        ? { text: "No voice heard", ok: false }
        : short
          ? { text: "Short. Read the whole script", ok: false }
          : checks.faceSeen && checks.voiceHeard
            ? { text: "Face and voice clear", ok: true }
            : null
  // What to say over the player: the file's verdict beats a per-press
  // symptom; a stall beats a refusal (it means the press was accepted); a
  // refusal is shown only while the custom button is up.
  const overlay = unplayable ? "unplayable" : problem === "stalled" ? "stalled" : problem === "refused" && !playing ? "refused" : null

  function play() {
    setProblem((p) => (p === "refused" ? null : p))
    void player.current?.play().catch((error: unknown) => {
      console.warn("Playback didn't start", error)
      // NotSupportedError is the file, and sticks; anything else (an abort
      // from a remount racing the press) is worth another try.
      if ((error as { name?: string } | null)?.name === "NotSupportedError") onPlayable(false)
      else setProblem("refused")
    })
  }

  // Nothing played within STALL_MS: a word for the person, a trace for us,
  // and no flag on the take, since nothing was reported.
  function stalled() {
    const el = player.current
    console.warn(`The review player hasn't started playing within ${STALL_MS} ms`, {
      mime: recording.mime,
      readyState: el?.readyState,
      networkState: el?.networkState,
      currentTime: el?.currentTime,
    })
    setProblem("stalled")
  }

  function startedPlaying() {
    clearStall()
    setProblem(null)
    onPlayable(true)
  }

  return (
    <ShotLayout
      frame={
        <ShotFrame>
          <video
            key={recording.url}
            ref={player}
            src={recording.url}
            playsInline
            controls={playing}
            onPlay={() => {
              setPlaying(true)
              // If nothing plays within a few seconds, say so (see PlaybackProblem).
              clearStall()
              stallTimer.current = window.setTimeout(stalled, STALL_MS)
            }}
            // `playing`, not `play`: `play` fires on the press; `playing` only
            // once the browser has decoded enough to advance.
            onPlaying={startedPlaying}
            // A pause before playback got going isn't a stall.
            onPause={clearStall}
            onError={(event) => {
              console.error("The review player can't play this recording", event.currentTarget.error, recording.mime)
              clearStall()
              onPlayable(false)
            }}
            className={cn("size-full object-cover", !playing && "-scale-x-100")}
          />
          {notice && (
            <p className="absolute inset-x-3 top-3 m-0 flex items-start gap-2 bg-stone-950/72 p-2.5 text-[13px] leading-[1.45] text-white">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-orange-300" aria-hidden />
              {notice.text}
            </p>
          )}
          {overlay && (
            <p className="absolute inset-x-4 bottom-16 m-0 bg-stone-950/72 p-2 text-center text-[13px] text-white">
              {overlay === "unplayable"
                ? notice?.partial
                  ? "This recording can't be played back, probably because it was cut off. You can still submit it, but we may not be able to use it; recording again is safer."
                  : "This recording looks damaged and may not play for us either. We recommend recording again."
                : overlay === "stalled"
                  ? "This recording isn't playing. You can still submit it; recording again is safer."
                  : "Playback didn't start. Try again."}
            </p>
          )}
          {!playing && (
            <button
              type="button"
              aria-label="Play recording"
              onClick={play}
              className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92"
            >
              <Play className="size-6 translate-x-0.5 fill-stone-950 text-stone-950" aria-hidden />
            </button>
          )}
          {!playing && !notice && recording.seconds > 0 && (
            <span className="absolute top-3.5 right-3.5 flex h-[26px] items-center rounded-full bg-stone-950/60 px-2.5 font-mono text-[12px] text-white">
              {clock(recording.seconds)}
            </span>
          )}
          {!playing && pill && <StatusPill tone={pill.ok ? "ok" : "warn"}>{pill.text}</StatusPill>}
        </ShotFrame>
      }
      buttons={
        <>
          <ShotButton type="button" onClick={onRedo}>
            Record again
          </ShotButton>
          <ShotButton type="button" primary disabled={!consent} onClick={onSubmit}>
            Submit recording
          </ShotButton>
        </>
      }
      below={
        <div className="flex flex-col items-center gap-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] leading-[1.4] text-stone-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => onConsent(e.target.checked)}
              className="m-0 size-[18px] shrink-0 accent-stone-950"
            />
            <span>{CONSENT_TEXT}</span>
          </label>
          {error && (
            <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[#c2410c]">
              {error}
            </p>
          )}
        </div>
      }
    />
  )
}

// The portrait photo just taken, in the frame it was framed in: keep it, or
// take it again. Shown mirrored, like the preview (the file itself isn't).
export function PhotoReviewStep({ photo, onUse, onRetake }: { photo: Photo; onUse: () => void; onRetake: () => void }) {
  return (
    <ShotLayout
      frame={
        <ShotFrame>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise */}
          <img src={photo.url} alt="Your portrait photo" className="size-full -scale-x-100 object-cover" />
          {photo.faceSeen !== null && (
            <StatusPill tone={photo.faceSeen ? "ok" : "warn"}>{photo.faceSeen ? "Face clear" : "Face not seen"}</StatusPill>
          )}
        </ShotFrame>
      }
      buttons={
        <>
          <ShotButton type="button" onClick={onRetake}>
            Retake
          </ShotButton>
          <ShotButton type="button" primary onClick={onUse}>
            Use this photo
          </ShotButton>
        </>
      }
    />
  )
}
