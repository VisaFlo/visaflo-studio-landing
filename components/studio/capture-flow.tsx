"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Lightbulb, Monitor, Image as ImageIcon, VolumeX, TriangleAlert } from "lucide-react"
import type { User } from "firebase/auth"

import {
  AlignStep,
  CameraAllowStep,
  CameraBlockedStep,
  ReviewStep,
  ScriptStep,
  TurnStep,
  type Pose,
} from "@/components/studio/capture-steps"
import {
  AccountHeader,
  Display,
  DoneMark,
  ErrorText,
  Field,
  FlowHeader,
  Page,
  PrimaryButton,
  QuietButton,
} from "@/components/studio/ui"
import { identify, track } from "@/lib/mixpanel"
import { signOutOfStudio, useStudioUser } from "@/lib/studio/auth"
import { CONSENT_TEXT, OWN_TOPIC_ID, scriptLines, TOPICS } from "@/lib/studio/content"
import { initials, loadProfile, saveProfile, type StudioProfile } from "@/lib/studio/profile"
import { pickRecordingMime, startRecording, type ActiveRecorder, type Recording } from "@/lib/studio/recorder"
import {
  lastSent,
  newSubmissionId,
  rememberSent,
  submitSampleRequest,
  uploadRecording,
  type SentRequest,
  type UploadHandle,
} from "@/lib/studio/upload"
import { cn } from "@/lib/utils"

type Step =
  | "loading"
  | "about"
  | "setup"
  | "camera"
  | "blocked"
  | "align"
  | "turn"
  | "script"
  | "review"
  | "topic"
  | "done"

type UploadState = {
  status: "idle" | "uploading" | "done" | "failed"
  progress: number
  /** Why it failed: a dropped connection, or the server refusing the file. */
  reason?: "network" | "refused"
}

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

export function CaptureFlow() {
  const router = useRouter()
  const user = useStudioUser()
  const [step, setStep] = useState<Step>("loading")
  const [profile, setProfile] = useState<StudioProfile>({ name: "", firm: "" })
  const [sent, setSent] = useState<SentRequest | null>(null)

  const [stream, setStream] = useState<MediaStream | null>(null)
  // Mirror of `stream` for cleanup paths (unmount) that can't rely on state.
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraBusy, setCameraBusy] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<Pose>({ yaw: 0, pitch: 0 })
  const recorder = useRef<ActiveRecorder | null>(null)
  const turnResult = useRef({ headTurn: false, faceSeen: false })

  const [recording, setRecording] = useState<Recording | null>(null)
  const [consent, setConsent] = useState(false)
  const [consentAt, setConsentAt] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const submissionId = useRef<string | null>(null)
  const upload = useRef<UploadHandle | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle", progress: 0 })
  const [topicId, setTopicId] = useState<string | null>(null)
  const [ownTopic, setOwnTopic] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const filePicker = useRef<HTMLInputElement>(null)

  // Signed out: back to sign in. Signed in: load what we know about them.
  useEffect(() => {
    if (user === null) {
      router.replace("/signin")
      return
    }
    if (!user) return
    let cancelled = false
    void loadProfile(user.uid).then((loaded) => {
      if (cancelled) return
      const next = { name: loaded.name ?? "", firm: loaded.firm ?? "" }
      setProfile(next)
      const previous = lastSent(user.uid)
      setSent(previous)
      setStep(previous ? "done" : next.name && next.firm ? "setup" : "about")
      identify((user.email ?? "").toLowerCase(), next)
    })
    return () => {
      cancelled = true
    }
  }, [user, router])

  useEffect(() => {
    if (step !== "loading") track("studio_step", { step })
  }, [step])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  // Turn the camera and any running recorder off when leaving the page.
  useEffect(
    () => () => {
      recorder.current?.cancel()
      stopCamera()
    },
    [stopCamera],
  )

  // Warn before closing the tab mid-recording or mid-upload.
  useEffect(() => {
    const busy = step === "turn" || step === "script" || uploadState.status === "uploading" || sending
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [step, uploadState.status, sending])

  const recordingSupported =
    typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(pickRecordingMime())

  async function openCamera() {
    setCameraError(null)
    setCameraBusy(true)
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = media
      setStream(media)
      setStep("align")
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ""
      if (name === "NotAllowedError" || name === "SecurityError") setStep("blocked")
      else if (name === "NotFoundError" || name === "OverconstrainedError")
        setCameraError("We couldn't find a camera and microphone. Plug one in, or upload a video instead.")
      else if (name === "NotReadableError")
        setCameraError("Another app is using your camera. Close it (Zoom, Teams, FaceTime), then try again.")
      else setCameraError("Your camera didn't start. Try again, or upload a video instead.")
      if (step !== "camera") setStep(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "camera")
    } finally {
      setCameraBusy(false)
    }
  }

  function beginTurn(pose: Pose) {
    if (!stream) return
    setBaseline(pose)
    recorder.current?.cancel()
    recorder.current = startRecording(stream)
    setStep("turn")
  }

  function restartRecording() {
    recorder.current?.cancel()
    recorder.current = null
    setStep(stream ? "align" : "camera")
  }

  const finishRecording = useCallback(async () => {
    const active = recorder.current
    recorder.current = null
    if (!active) return
    const result = await active.stop()
    // Restart was pressed while this clip was finishing: keep the new take.
    if (recorder.current) return
    stopCamera()
    setRecording((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return {
        blob: result.blob,
        url: URL.createObjectURL(result.blob),
        mime: result.mime,
        seconds: result.seconds,
        source: "camera",
        checks: { ...turnResult.current, voiceHeard: result.voiceHeard },
      }
    })
    setReviewError(null)
    setStep("review")
  }, [stopCamera])

  function pickFile() {
    filePicker.current?.click()
  }

  function onFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("video/")) {
      setCameraError("That file isn't a video. Choose an MP4 or MOV file.")
      setStep("camera")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setCameraError("That video is over 500 MB. Trim it to about a minute, then upload it.")
      setStep("camera")
      return
    }
    recorder.current?.cancel()
    recorder.current = null
    stopCamera()
    const url = URL.createObjectURL(file)
    const probe = document.createElement("video")
    probe.preload = "metadata"
    probe.onloadedmetadata = () => {
      const seconds = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0
      setRecording((r) => (r && r.url === url ? { ...r, seconds } : r))
    }
    probe.src = url
    setRecording((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return { blob: file, url, mime: file.type, seconds: 0, source: "upload" }
    })
    setReviewError(null)
    setStep("review")
  }

  function startUpload(current: User, rec: Recording) {
    upload.current?.cancel()
    submissionId.current ??= newSubmissionId()
    setUploadState({ status: "uploading", progress: 0 })
    const handle = uploadRecording(current, submissionId.current, rec, (progress) =>
      setUploadState((s) => (s.status === "uploading" ? { status: "uploading", progress } : s)),
    )
    upload.current = handle
    handle.done
      .then(() => setUploadState({ status: "done", progress: 1 }))
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === "storage/canceled") return
        console.error("Upload failed", error)
        const code = (error as { code?: string })?.code ?? ""
        const refused = code === "storage/unauthorized" || code === "storage/unauthenticated"
        setUploadState((s) => ({ status: "failed", progress: s.progress, reason: refused ? "refused" : "network" }))
      })
  }

  function submitRecording() {
    if (!user || !recording) return
    if (recording.blob.size > MAX_UPLOAD_BYTES) {
      setReviewError(
        recording.source === "camera"
          ? "This recording is over 500 MB. Record again and keep it to about a minute and a half."
          : "That video is over 500 MB. Trim it to about a minute, then upload it.",
      )
      return
    }
    setConsentAt(new Date().toISOString())
    // A new recording is a new submission.
    submissionId.current = null
    startUpload(user, recording)
    track("studio_recording_submitted", { source: recording.source, seconds: recording.seconds })
    setStep("topic")
  }

  const topicTitle =
    topicId === OWN_TOPIC_ID ? ownTopic.trim() : (TOPICS.find((t) => t.id === topicId)?.title ?? "")

  // "Make my sample" can be pressed while the upload is still running; the
  // request goes out the moment the file is in. Everything it sends is read
  // here, once, so changing the topic mid-wait can't send a second request.
  async function makeSample() {
    if (!topicTitle || !user || !recording || !upload.current || sending) return
    const handle = upload.current
    const request = {
      submissionId: submissionId.current ?? "",
      recordingPath: handle.path,
      recordingSeconds: recording.seconds,
      recordingSource: recording.source,
      checks: recording.checks,
      name: profile.name,
      firm: profile.firm,
      topicId: topicId ?? "",
      topicTitle,
      consent: CONSENT_TEXT,
      consentAt: consentAt ?? new Date().toISOString(),
    }
    setSendError(null)
    setSending(true)
    try {
      await handle.done
    } catch {
      // The upload banner already says what went wrong and offers Retry.
      setSending(false)
      return
    }
    try {
      await submitSampleRequest(user, request)
      const record = { topicTitle: request.topicTitle, at: new Date().toISOString() }
      rememberSent(user.uid, record)
      setSent(record)
      track("studio_sample_requested", { topic: request.topicId, source: request.recordingSource })
      setStep("done")
    } catch (error) {
      console.error("Request failed", error)
      setSendError(error instanceof Error ? error.message : "We couldn't send your request. Try again.")
    } finally {
      setSending(false)
    }
  }

  function startAnother() {
    upload.current?.cancel()
    setRecording((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return null
    })
    setConsent(false)
    setTopicId(null)
    setOwnTopic("")
    setUploadState({ status: "idle", progress: 0 })
    upload.current = null
    submissionId.current = null
    setStep("setup")
  }

  async function signOut() {
    stopCamera()
    await signOutOfStudio()
    router.replace("/signin")
  }

  const lines = useMemo(() => scriptLines(profile.name, profile.firm), [profile.name, profile.firm])

  const email = user?.email ?? ""
  const account = (
    <AccountHeader
      name={profile.name}
      email={email}
      initials={initials(profile.name, email)}
      onSignOut={() => void signOut()}
    />
  )

  const picker = (
    <input
      ref={filePicker}
      type="file"
      accept="video/*"
      className="hidden"
      onChange={(e) => {
        onFile(e.target.files?.[0])
        e.target.value = ""
      }}
    />
  )

  if (step === "loading" || !user) {
    return (
      <Page>
        <AccountHeader />
        <main className="flex flex-grow items-center justify-center text-[14px] text-stone-500">Loading…</main>
      </Page>
    )
  }

  return (
    <Page>
      {picker}
      {step === "about" && (
        <>
          {account}
          <AboutStep
            initial={profile}
            onContinue={(next) => {
              saveProfile(user.uid, next)
              setProfile(next)
              identify(email.toLowerCase(), next)
              setStep("setup")
            }}
          />
        </>
      )}

      {step === "setup" && (
        <>
          {account}
          <SetupStep
            firm={profile.firm}
            onStart={() => setStep(stream ? "align" : "camera")}
            onEditProfile={() => setStep("about")}
          />
        </>
      )}

      {(step === "camera" || step === "blocked") && (
        <>
          <FlowHeader title="Face and voice" step="Step 1 of 3" onBack={() => setStep("setup")} />
          {step === "camera" ? (
            <CameraAllowStep
              unsupported={!recordingSupported}
              error={cameraError}
              busy={cameraBusy}
              onAllow={() => void openCamera()}
              onUpload={pickFile}
            />
          ) : (
            <CameraBlockedStep onRetry={() => void openCamera()} onUpload={pickFile} />
          )}
        </>
      )}

      {step === "align" && stream && (
        <>
          <FlowHeader title="Face and voice" step="Step 1 of 3" onBack={() => { stopCamera(); setStep("setup") }} />
          <AlignStep stream={stream} onStart={beginTurn} />
        </>
      )}

      {step === "turn" && stream && (
        <>
          <FlowHeader title="Face and voice" step="Step 2 of 3" onBack={restartRecording} />
          <TurnStep
            stream={stream}
            baseline={baseline}
            onStartOver={restartRecording}
            onDone={(result) => {
              turnResult.current = result
              setStep("script")
            }}
          />
        </>
      )}

      {step === "script" && stream && (
        <>
          <FlowHeader title="Face and voice" step="Step 3 of 3" onBack={restartRecording} />
          <ScriptStep
            stream={stream}
            lines={lines}
            onStop={() => void finishRecording()}
            onRestart={() => {
              recorder.current?.cancel()
              recorder.current = startRecording(stream)
              setStep("turn")
            }}
          />
        </>
      )}

      {step === "review" && recording && (
        <>
          <FlowHeader
            title="Review"
            onBack={() => (recording.source === "camera" ? setStep("camera") : setStep("setup"))}
          />
          <ReviewStep
            recording={recording}
            consent={consent}
            onConsent={setConsent}
            error={reviewError}
            onSubmit={submitRecording}
            onRedo={() => (recording.source === "camera" ? setStep("camera") : pickFile())}
          />
        </>
      )}

      {step === "topic" && (
        <>
          {account}
          <UploadBanner
            state={uploadState}
            onRetry={() => recording && startUpload(user, recording)}
          />
          <TopicStep
            topicId={topicId}
            ownTopic={ownTopic}
            onTopic={setTopicId}
            onOwnTopic={setOwnTopic}
            canSubmit={Boolean(topicTitle) && uploadState.status !== "failed"}
            sending={sending}
            waitingForUpload={sending && uploadState.status === "uploading"}
            error={sendError}
            onSubmit={() => void makeSample()}
          />
        </>
      )}

      {step === "done" && (
        <>
          {account}
          <DoneStep email={email} topicTitle={sent?.topicTitle ?? topicTitle} onAnother={startAnother} />
        </>
      )}
    </Page>
  )
}

function AboutStep({ initial, onContinue }: { initial: StudioProfile; onContinue: (p: StudioProfile) => void }) {
  const [name, setName] = useState(initial.name)
  const [firm, setFirm] = useState(initial.firm)
  const ready = name.trim() && firm.trim()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (ready) onContinue({ name: name.trim(), firm: firm.trim() })
  }

  return (
    <main className="mx-auto flex w-full max-w-[528px] flex-grow flex-col gap-8 px-(--page-pad) pt-12 pb-16 sm:pt-24">
      <Display>About you</Display>
      <form onSubmit={submit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-6">
          <Field id="name" label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field
            id="firm"
            label="Firm name"
            autoComplete="organization"
            placeholder="Lopez Immigration"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
          />
        </div>
        <PrimaryButton type="submit" disabled={!ready} className="self-start">
          Continue
        </PrimaryButton>
      </form>
    </main>
  )
}

const TIPS = [
  { icon: Lightbulb, text: "Face a window or lamp" },
  { icon: VolumeX, text: "Quiet room" },
  { icon: Monitor, text: "Camera at eye level" },
  { icon: ImageIcon, text: "Plain wall behind you" },
]

function SetupStep({ firm, onStart, onEditProfile }: { firm: string; onStart: () => void; onEditProfile: () => void }) {
  const rows = [
    { label: "Face and voice", meta: "About 3 min" },
    { label: "Pick a topic", meta: "This week's IRCC news" },
    { label: "Get your sample", meta: "We email it to you" },
  ]
  return (
    <main className="mx-auto grid w-full max-w-[1120px] flex-grow grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] content-start items-start gap-10 px-(--page-pad) pt-10 pb-16 sm:gap-16 sm:pt-20">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          {firm && (
            <button
              type="button"
              onClick={onEditProfile}
              title="Edit your name and firm"
              className="self-start bg-stone-950 px-1.5 py-0.5 font-mono text-[12px] font-bold tracking-[0.1em] text-white uppercase"
            >
              {firm}
            </button>
          )}
          <Display>Your sample video</Display>
        </div>
        <ol className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
          {rows.map((row, i) => (
            <li key={row.label} className="flex items-center gap-4 border-b border-stone-200 py-4">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center font-mono text-[14px]",
                  i === 0 ? "bg-stone-950 text-white" : "border border-stone-300 text-stone-600",
                )}
              >
                {i + 1}
              </span>
              <span className={cn("flex-grow text-[16px] font-medium", i > 0 && "text-stone-700")}>{row.label}</span>
              <span className="text-right text-[14px] text-stone-600">{row.meta}</span>
            </li>
          ))}
        </ol>
        <PrimaryButton type="button" onClick={onStart} className="self-start">
          Start recording
        </PrimaryButton>
      </div>
      <aside aria-label="Before you record" className="flex flex-col gap-4 border border-stone-200 bg-stone-50 p-6 sm:p-8">
        <h2 className="m-0 text-[16px] font-semibold">Before you record</h2>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {TIPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[16px]">
              <Icon className="size-5 text-stone-700" strokeWidth={1.6} aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  )
}

function UploadBanner({ state, onRetry }: { state: UploadState; onRetry: () => void }) {
  if (state.status === "idle" || state.status === "done") return null
  const percent = Math.round(state.progress * 100)
  return (
    <div
      role={state.status === "failed" ? "alert" : "status"}
      className="shrink-0 border-b border-stone-200 bg-stone-50"
    >
      <div className="mx-auto flex w-full max-w-[816px] items-center gap-3 px-(--page-pad) py-3 text-[14px] sm:gap-4">
        {state.status === "failed" ? (
          <>
            <TriangleAlert className="size-5 shrink-0 text-[#c2410c]" strokeWidth={1.8} aria-hidden />
            {state.reason === "refused" ? (
              <span className="flex-grow">
                <span className="font-medium">We couldn&apos;t save your recording.</span>{" "}
                <span className="text-stone-600">
                  Sign out and back in, then retry. Still stuck? Email info@vflo.app.
                </span>
              </span>
            ) : (
              <span className="flex-grow">
                <span className="font-medium">Upload stopped at {percent}%.</span>{" "}
                <span className="text-stone-600">Check your connection. Your recording is saved.</span>
              </span>
            )}
            <button
              type="button"
              onClick={onRetry}
              className="flex h-11 items-center border border-stone-950 px-4 font-medium hover:bg-white"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <span className="whitespace-nowrap text-stone-700">Uploading recording</span>
            <span className="relative h-1 flex-grow overflow-hidden bg-stone-200">
              <span
                className="absolute inset-y-0 left-0 bg-stone-950 transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="font-mono text-stone-700">{percent}%</span>
          </>
        )}
      </div>
    </div>
  )
}

function TopicStep({
  topicId,
  ownTopic,
  onTopic,
  onOwnTopic,
  canSubmit,
  sending,
  waitingForUpload,
  error,
  onSubmit,
}: {
  topicId: string | null
  ownTopic: string
  onTopic: (id: string) => void
  onOwnTopic: (value: string) => void
  canSubmit: boolean
  sending: boolean
  waitingForUpload: boolean
  error: string | null
  onSubmit: () => void
}) {
  const options = [...TOPICS, { id: OWN_TOPIC_ID, title: "Something else", detail: "Your topic, your angle" }]
  return (
    <main className="mx-auto flex w-full max-w-[816px] flex-grow flex-col gap-8 px-(--page-pad) py-10 sm:py-16">
      <div className="flex flex-col gap-4">
        <Display>Pick a topic</Display>
        <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
          We&apos;ll use the freshest update in the area you pick.
        </p>
      </div>
      <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-3 border-0 p-0">
        <legend className="sr-only">Topic for your sample video</legend>
        {options.map((topic) => {
          const selected = topicId === topic.id
          return (
            <label
              key={topic.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 border p-5",
                selected ? "border-stone-950" : "border-stone-200 hover:border-stone-400",
              )}
            >
              <input
                type="radio"
                name="topic"
                checked={selected}
                onChange={() => onTopic(topic.id)}
                className="mt-0.5 size-5 shrink-0 accent-stone-950"
              />
              <span className="flex flex-col gap-1">
                <span className="text-[16px] leading-[1.4] font-medium">{topic.title}</span>
                <span className="text-[14px] text-stone-600">{topic.detail}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      {topicId === OWN_TOPIC_ID && (
        <Field
          id="own-topic"
          label="What should the video be about?"
          placeholder="e.g. Common reasons visitor visas get refused"
          value={ownTopic}
          maxLength={300}
          onChange={(e) => onOwnTopic(e.target.value)}
          autoFocus
        />
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <PrimaryButton type="button" disabled={!canSubmit || sending} onClick={onSubmit} className="self-start">
        {waitingForUpload ? "Finishing upload…" : sending ? "Sending…" : "Make my sample"}
      </PrimaryButton>
    </main>
  )
}

function DoneStep({ email, topicTitle, onAnother }: { email: string; topicTitle: string; onAnother: () => void }) {
  return (
    <main className="mx-auto grid w-full max-w-[1120px] flex-grow grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] content-start items-start gap-10 px-(--page-pad) pt-12 pb-16 sm:gap-16 sm:pt-20">
      <div className="flex flex-col gap-4">
        <Display>Your sample is in the works</Display>
        <p className="m-0 text-[18px] leading-[1.5] text-stone-600">
          We&apos;ll email <span className="font-medium text-stone-950">{email}</span> when it&apos;s ready.
        </p>
      </div>
      <div className="flex flex-col gap-8">
        <ol className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
          <li className="flex items-center gap-4 border-b border-stone-200 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center bg-[#eef0e9]">
              <DoneMark className="size-4 stroke-[#3a4536]" />
            </span>
            <span className="flex-grow text-[16px] font-medium">Face and voice</span>
          </li>
          <li className="flex items-center gap-4 border-b border-stone-200 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center bg-[#eef0e9]">
              <DoneMark className="size-4 stroke-[#3a4536]" />
            </span>
            <span className="flex flex-grow flex-col gap-1">
              <span className="text-[16px] font-medium">Topic</span>
              {topicTitle && <span className="text-[14px] text-stone-600">{topicTitle}</span>}
            </span>
          </li>
          <li className="flex items-center gap-4 border-b border-stone-200 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center bg-stone-950 font-mono text-[14px] text-white">
              3
            </span>
            <span className="flex flex-grow flex-col gap-1">
              <span className="text-[16px] font-medium">Your sample</span>
              <span className="text-[14px] text-stone-600">In progress</span>
            </span>
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/" className="flex h-11 items-center text-[14px] text-stone-600 underline underline-offset-[3px] hover:text-stone-950">
            Back to Studio
          </Link>
          <QuietButton type="button" onClick={onAnother}>
            Record a new one
          </QuietButton>
        </div>
      </div>
    </main>
  )
}
