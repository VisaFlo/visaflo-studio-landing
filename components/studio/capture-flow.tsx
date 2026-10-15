"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { Camera, Newspaper, Send, TriangleAlert, Video } from "lucide-react"

import {
  AlignStep,
  CameraAllowStep,
  CameraBlockedStep,
  CountdownStep,
  FaceWatch,
  PhotoReviewStep,
  ReviewStep,
  ScriptStep,
  type ReviewNotice,
} from "@/components/studio/capture-steps"
import { GuideStep, PHOTO_GUIDE, VIDEO_GUIDE } from "@/components/studio/guide"
import {
  Display,
  DoneMark,
  ErrorText,
  Field,
  MonoLabel,
  Page,
  PrimaryButton,
  QuietButton,
  StepsHeader,
  type HeaderStep,
} from "@/components/studio/ui"
import { identify, track } from "@/lib/mixpanel"
import { faceVerdict, markPlayable, RECOVERED_CHECKS, type Check, type RecordingChecks } from "@/lib/studio/checks"
import { CONSENT_TEXT, OWN_TOPIC_ID, scriptLines, TOPICS } from "@/lib/studio/content"
import { ApiError, describeSubmitError, uploadFailureReason, type UploadFailure } from "@/lib/studio/errors"
import { capturePhoto, type Photo } from "@/lib/studio/photo"
import { portraitStream, type PortraitStream } from "@/lib/studio/portrait"
import { EMPTY_PROFILE, loadProfile, profileComplete, saveProfile, type StudioProfile } from "@/lib/studio/profile"
import { asEmail, fullName } from "@/lib/studio/request-json"
import { pickRecordingMime, startRecording, type ActiveRecorder, type Recording, type StoppedTake } from "@/lib/studio/recorder"
import { beginTake, clearPhoto, clearTake, finishTake, loadPhoto, loadTake, saveChunk, savePhoto } from "@/lib/studio/take-store"
import {
  headerStep,
  reachedAfterNewPhoto,
  reachedAfterNewTake,
  reachedOnVisit,
  stepIndex,
  STEPS,
  type CameraFor,
  type Step,
} from "@/lib/studio/flow-steps"
import {
  lastSent,
  newSubmissionId,
  photoPath,
  recordingPath,
  rememberSent,
  submitSampleRequest,
  uploadPhoto,
  uploadRecording,
  type SentRequest,
} from "@/lib/studio/upload"
import { cancelPlan, filesToStart, isFor, planFor, settlePlan, startFile, type UploadPlan } from "@/lib/studio/upload-plan"
import { cn } from "@/lib/utils"

// The recording upload, for the banner. A failure keeps how far it got and
// says why (see uploadFailureReason).
type UploadState = { status: "idle" } | { status: "uploading"; progress: number } | { status: "done" } | ({ status: "failed"; progress: number } & UploadFailure)

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

const CUT_OFF_NOTICE: ReviewNotice = {
  text: "Recording stopped early. We kept what was recorded up to that point. Watch it, then submit it or record again.",
  partial: true,
}

export function CaptureFlow() {
  const [step, setStep] = useState<Step>("loading")
  const [cameraFor, setCameraFor] = useState<CameraFor>("photo")
  // The furthest step reached: the header opens any step up to it (see
  // lib/studio/flow-steps.ts).
  const [reached, setReached] = useState(0)
  const [reachedFor, setReachedFor] = useState<Step>(step)
  const at = stepIndex(step, cameraFor)
  if (reachedFor !== step) {
    setReachedFor(step)
    setReached((r) => reachedOnVisit(r, at))
  }
  const [profile, setProfile] = useState<StudioProfile>(EMPTY_PROFILE)
  const [sent, setSent] = useState<SentRequest | null>(null)

  // What gets previewed and recorded: the vertical crop of the camera.
  const [stream, setStream] = useState<MediaStream | null>(null)
  const portrait = useRef<PortraitStream | null>(null)
  // The camera itself: the face check reads it, and cleanup paths (unmount)
  // that can't rely on state use the ref.
  const [camera, setCamera] = useState<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraBusy, setCameraBusy] = useState(false)
  // Set once the browser has let us have the camera: going back to a camera
  // screen later (Retake, Record again) reopens it without the Allow screen.
  const cameraAllowed = useRef(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const recorder = useRef<ActiveRecorder | null>(null)
  // Counts takes, so a Finish that was still completing when the person
  // pressed Start over doesn't go on to the review.
  const take = useRef(0)
  // The recorder a Finish is waiting on: the saved take is the Finish's (only
  // Start over may still discard it, by cancelling this), and a camera that
  // dies meanwhile must not interrupt it.
  const finishing = useRef<ActiveRecorder | null>(null)
  // Why the camera died during that Finish, for whichever exit comes next.
  const cameraLost = useRef<string | null>(null)
  // What the framing step saw (null: the tracker never ran) and a tally of
  // the readings while recording, which decide the recording's face check.
  const alignFaceSeen = useRef<Check>(null)
  const faceFrames = useRef({ total: 0, found: 0 })

  const [recording, setRecording] = useState<Recording | null>(null)
  const [consent, setConsent] = useState(false)
  const [consentAt, setConsentAt] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  // Why the take on review needs a word (recovered, or cut off), and whether
  // it is only part of what was recorded, which changes what an unplayable
  // file means. Null for a fresh, whole take.
  const [reviewNotice, setReviewNotice] = useState<ReviewNotice | null>(null)

  // The portrait photo, kept (with the take) until the request is sent.
  const [photo, setPhoto] = useState<Photo | null>(null)
  // Remounts the photo framing after a failed capture, so its face check starts fresh.
  const [photoAttempt, setPhotoAttempt] = useState(0)
  const [photoError, setPhotoError] = useState<string | null>(null)
  // A guide opened from its camera screen ("Remind me…", "Video tips"): its
  // back arrow returns to that screen.
  const [tipsOnly, setTipsOnly] = useState(false)

  // The submission being uploaded: its folder, and the take and photo it is
  // for (see lib/studio/upload-plan.ts).
  const uploadPlan = useRef<UploadPlan<Recording, Photo> | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" })
  const [topicId, setTopicId] = useState<string | null>(null)
  const [ownTopic, setOwnTopic] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // What this browser knows about them: who they said they are, a request
  // already sent, a photo and a take left from last time.
  useEffect(() => {
    let cancelled = false
    void Promise.all([loadTake(), loadPhoto()])
      .then(([saved, savedPhoto]) => {
        if (cancelled) return
        if (savedPhoto) setPhoto({ ...savedPhoto, url: URL.createObjectURL(savedPhoto.blob) })
        const next = loadProfile()
        const complete = profileComplete(next)
        setProfile(next)
        const previous = lastSent()
        setSent(previous)
        if (complete) identify(next.email.toLowerCase(), { name: fullName(next.firstName, next.lastName), firm: next.firm })
        // A take left from a reload or a closed tab: pick up at review rather
        // than making them record again. One kept without its photo (the
        // browser wouldn't store it) says so; the photo is taken again first.
        if (!previous && saved && complete) {
          const { take: stored, blob, chunks } = saved
          setRecording({
            blob,
            url: URL.createObjectURL(blob),
            mime: stored.mime,
            seconds: stored.finished?.seconds ?? chunks,
            source: "camera",
            // Nothing was saved for an unfinished take: say so rather than
            // leave the checks out, so the team reads "not recorded".
            checks: stored.finished?.checks ?? RECOVERED_CHECKS,
          })
          setReached(2)
          const notice: ReviewNotice = !stored.finished
            ? { text: "The page closed while you were recording. We kept what you recorded up to that point. Watch it, then submit it or record again.", partial: true }
            : stored.finished.cutOff
              ? CUT_OFF_NOTICE
              : { text: "We kept your last recording. Watch it, then submit it or record again.", partial: false }
          setReviewNotice(savedPhoto ? notice : { ...notice, text: `${notice.text} Your photo wasn't kept, so take it again first.` })
          setStep("review")
          return
        }
        setStep(previous ? "done" : "about")
      })
      .catch((error: unknown) => {
        // Never leave the page on "Loading…": without a profile, start at the top.
        console.error("Loading the studio profile failed", error)
        if (!cancelled) setStep("about")
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (step !== "loading") track("studio_step", { step })
  }, [step])

  const stopCamera = useCallback(() => {
    portrait.current?.stop()
    portrait.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamera(null)
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
    const busy = step === "countdown" || step === "script" || uploadState.status === "uploading" || sending
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [step, uploadState.status, sending])

  const recordingSupported =
    typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(pickRecordingMime())

  // The camera or the recorder gave out (unplugged, taken by another app, a
  // tab the phone put to sleep): stop pretending to record and say so (also
  // how a Finish that collected nothing is reported). A take in progress goes
  // too, saved chunks included, or a later visit would offer it back as "the
  // page closed while you were recording", which isn't what happened.
  const abandonCamera = useCallback(
    (reason: string) => {
      // A Finish already waiting on its data owns the take: the dead tracks
      // sit until the Finish settles (finishRecording releases them on its
      // way to the review, with its own notice: cutOff, if the recorder
      // noticed). Releasing them here would unmount the script step onto a
      // blank page meanwhile. The reason is kept for a Start over pressed
      // before then, which must not reuse the dead camera.
      if (finishing.current) {
        cameraLost.current = reason
        return
      }
      // Otherwise only a take in progress is abandoned; with nothing
      // recording (the align step) a saved take is the review step's to keep
      // or clear and stays.
      const active = recorder.current
      recorder.current = null
      if (active) {
        take.current += 1
        active.cancel()
        void clearTake()
      }
      stopCamera()
      setCameraError(reason)
      setStep("camera")
    },
    [stopCamera],
  )

  async function openCamera(target: CameraFor) {
    setCameraFor(target)
    setCameraError(null)
    setCameraBusy(true)
    try {
      // Biggest frame the camera has in either orientation: a phone held
      // upright gives portrait, a laptop webcam gives 16:9 and is cropped
      // to its middle 9:16 column below.
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1920 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      // A track that ends on its own (stop() doesn't fire this) means the
      // camera went away; the cropped canvas stream would keep drawing the
      // last frame, so it has to be caught here.
      for (const track of media.getTracks()) {
        track.addEventListener("ended", () => {
          if (streamRef.current !== media) return
          console.error(`The camera's ${track.kind} track ended on its own`)
          abandonCamera("Your camera or microphone stopped. Plug it back in or close the app using it, then try again.")
        })
      }
      streamRef.current = media
      cameraAllowed.current = true
      setCamera(media)
      portrait.current?.stop()
      portrait.current = portraitStream(media)
      setStream(portrait.current.stream)
      setStep(target)
    } catch (error) {
      console.error("Opening the camera failed", error)
      // A stream that did open (portraitStream threw after getUserMedia) must
      // not stay live behind an error message.
      stopCamera()
      const name = error instanceof DOMException ? error.name : ""
      if (name === "NotAllowedError" || name === "SecurityError") setStep("blocked")
      else if (name === "NotFoundError" || name === "OverconstrainedError")
        setCameraError("We couldn't find a camera and microphone. Plug one in, or open this page on your phone.")
      else if (name === "NotReadableError")
        setCameraError("Another app is using your camera. Close it (Zoom, Teams, FaceTime), then try again.")
      else setCameraError("Your camera didn't start. Try again, or open this page on your phone.")
      if (step !== "camera") setStep(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "camera")
    } finally {
      setCameraBusy(false)
    }
  }

  // Every take is saved chunk by chunk as it records (see take-store).
  function recordTake(media: MediaStream): ActiveRecorder {
    const takeId = crypto.randomUUID()
    void beginTake({
      takeId,
      mime: pickRecordingMime() ?? "video/webm",
      source: "camera",
      startedAt: Date.now(),
    })
    return startRecording(media, {
      onChunk: (chunk, index) => void saveChunk(takeId, index, chunk),
      onEnded: (reason) => {
        console.error(`Recording ended on its own (${reason})`)
        abandonCamera(
          reason === "error"
            ? "Recording failed in this browser. Try again, or open this page in Chrome or Safari, or on your phone."
            : "Recording stopped: your camera or microphone was lost. Try again, or open this page on your phone.",
        )
      },
    })
  }

  // Take photo pressed: take the still from the preview they framed
  // themselves in.
  async function takePhoto(result: { faceSeen: Check; preview: HTMLVideoElement | null }) {
    setPhotoError(null)
    try {
      if (!result.preview) throw new Error("No camera preview to take the photo from")
      const next = await capturePhoto(result.preview, result.faceSeen)
      setPhoto((previous) => {
        if (previous) URL.revokeObjectURL(previous.url)
        return next
      })
      // The take stays, but has to be submitted again with the new photo.
      setReached((r) => reachedAfterNewPhoto(r, Boolean(recording)))
      setStep("photo-review")
    } catch (error) {
      console.error("Taking the portrait photo failed", error)
      setPhotoError("We couldn't take the photo. Hold still and try again.")
      setPhotoAttempt((n) => n + 1)
    }
  }

  function keepPhoto() {
    if (!photo) return
    void savePhoto({ blob: photo.blob, width: photo.width, height: photo.height, faceSeen: photo.faceSeen })
    track("studio_photo_taken", { faceSeen: photo.faceSeen })
    setTipsOnly(false)
    // Changing the photo of a take already recorded goes back to that take,
    // with the camera off (the video step reopens it).
    if (recording) {
      stopCamera()
      setStep("review")
      return
    }
    setStep("video-guide")
  }

  // Start recording pressed: what the framing check saw is kept, and the
  // full-screen countdown runs.
  function startCountdown(result: { faceSeen: Check }) {
    alignFaceSeen.current = result.faceSeen
    setStep("countdown")
  }

  // The countdown ended: recording starts and the script comes up.
  function beginScript() {
    if (!stream) return
    take.current += 1
    faceFrames.current = { total: 0, found: 0 }
    recorder.current?.cancel()
    try {
      recorder.current = recordTake(stream)
    } catch (error) {
      // MediaRecorder refused the stream (this browser can't record a canvas
      // stream with the chosen type, or a track ended), or recordTake's own
      // guard refused. Say so instead of leaving the countdown stuck on 1.
      console.error("MediaRecorder failed to start", error)
      recorder.current = null
      stopCamera()
      setCameraError("We couldn't start recording in this browser. Try Chrome or Safari, or open this page on your phone.")
      setStep("camera")
      return
    }
    setStep("script")
  }

  // Start over, from the script step only: the take being recorded (or still
  // finishing) is the person's to discard, saved chunks included, or a later
  // visit would offer it back as a take the page lost.
  function restartRecording() {
    take.current += 1
    const active = recorder.current
    recorder.current = null
    active?.cancel()
    // A Finish still waiting is ended now, so its recorder can't save a late
    // chunk under the take being cleared; finishRecording drops its result,
    // since take.current has moved on.
    finishing.current?.cancel()
    finishing.current = null
    void clearTake()
    // A camera that died during that Finish was only noted: say so now
    // rather than frame the person over its dead tracks.
    const lost = cameraLost.current
    cameraLost.current = null
    if (lost) {
      stopCamera()
      setCameraError(lost)
      setStep("camera")
      return
    }
    setStep(stream ? "align" : "camera")
  }

  const finishRecording = useCallback(async () => {
    const active = recorder.current
    recorder.current = null
    if (!active) return
    const started = take.current
    finishing.current = active
    let result: StoppedTake
    try {
      // stop() waits for the recorder's final data, or gives up after a few
      // seconds with what there is (then `cutOff`), and cleans up either way.
      result = await active.stop()
    } finally {
      if (finishing.current === active) finishing.current = null
    }
    // Start over was pressed while this clip was finishing: that decision
    // wins. (A camera that died meanwhile does not: abandonCamera leaves a
    // Finish in flight alone, so the take still reaches the review.)
    if (take.current !== started) return
    // The take is in hand, so a camera that died meanwhile only matters if
    // there is nothing to show for it.
    const lost = cameraLost.current
    cameraLost.current = null
    if (result.blob.size === 0) {
      // A recorder that produced nothing must not reach the review as a
      // black clip that can be submitted.
      console.error("The recorder produced no data", { seconds: result.seconds, mime: result.mime })
      abandonCamera(lost ?? "Nothing was recorded. Try again, or open this page in Chrome or Safari, or on your phone.")
      return
    }
    stopCamera()
    setCameraError(null)
    const checks: RecordingChecks = { faceSeen: faceVerdict(faceFrames.current, alignFaceSeen.current), voiceHeard: result.voiceHeard }
    void finishTake({ seconds: result.seconds, checks, cutOff: result.cutOff })
    setRecording((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return {
        blob: result.blob,
        url: URL.createObjectURL(result.blob),
        mime: result.mime,
        seconds: result.seconds,
        source: "camera",
        checks,
      }
    })
    setReviewError(null)
    setReviewNotice(result.cutOff ? CUT_OFF_NOTICE : null)
    setReached(reachedAfterNewTake)
    setStep("review")
  }, [abandonCamera, stopCamera])

  // The photo and the recording go up together into the submission's folder;
  // the banner shows the recording's progress, the photo being a fraction of
  // its size, and fails only once both have settled. `refused`: the Retry
  // after a refusal, which starts a new folder (see upload-plan.ts).
  function startUpload(rec: Recording, still: Photo, { refused = false } = {}) {
    const previous = uploadPlan.current
    const plan = planFor(previous, rec, still, { refused, newId: newSubmissionId })
    if (plan !== previous) cancelPlan(previous)
    uploadPlan.current = plan
    const starting = filesToStart(plan)
    const recordingDone = plan.files.recording?.status === "done"
    setUploadState((s) => ({
      status: "uploading",
      progress: recordingDone ? 1 : starting.includes("recording") ? 0 : s.status === "uploading" ? s.progress : 0,
    }))
    let startError: unknown = null
    try {
      for (const name of starting) {
        startFile(plan, name, () =>
          name === "photo"
            ? { done: uploadPhoto(profile.email, plan.submissionId, still.blob), cancel: () => {} }
            : uploadRecording(profile.email, plan.submissionId, rec, (progress) => {
                if (uploadPlan.current === plan) setUploadState((s) => (s.status === "uploading" ? { status: "uploading", progress } : s))
              }),
        )
      }
    } catch (error) {
      // The SDK refused before any request (no storage, a bad ref): the banner
      // says so rather than sitting on "uploading".
      console.error("Upload didn't start", error)
      startError = error
      setUploadState({ status: "failed", progress: 0, ...uploadFailureReason(error) })
    }
    // Every failure is logged, even of a submission since replaced; the
    // banner follows only the current one. A refusal wins over the other
    // reasons, since its Retry has to start a new folder.
    void settlePlan(plan).then(({ complete, failures }) => {
      for (const failure of failures) console.error(`Upload of the ${failure.name} failed`, failure.error)
      if (uploadPlan.current !== plan) return
      if (complete) {
        setUploadState({ status: "done" })
        return
      }
      const reasons = failures.map((failure) => uploadFailureReason(failure.error))
      if (startError !== null) reasons.push(uploadFailureReason(startError))
      if (!reasons.length) {
        console.error("The upload ended without every file and without a failure", Object.keys(plan.files))
        reasons.push({ reason: "other", code: "incomplete" })
      }
      const reason = reasons.find((r) => r.reason === "refused") ?? reasons[0]
      setUploadState((s) => ({ status: "failed", progress: s.status === "uploading" ? s.progress : 0, ...reason }))
    })
  }

  function retryUpload() {
    if (!recording || !photo) return
    startUpload(recording, photo, { refused: uploadState.status === "failed" && uploadState.reason === "refused" })
  }

  function submitRecording() {
    if (!recording) return
    if (!photo) {
      // A take recovered without its photo: the photo comes first.
      setReviewError("Take your portrait photo first: open Take a photo above.")
      return
    }
    if (recording.blob.size === 0) {
      setReviewError("This recording is empty. Record again.")
      return
    }
    if (recording.blob.size > MAX_UPLOAD_BYTES) {
      setReviewError("This recording is over 500 MB. Record again and keep it to about 30 seconds.")
      return
    }
    setConsentAt(new Date().toISOString())
    // The same take and photo keep their submission, unless it was refused;
    // a new take or photo starts another.
    startUpload(recording, photo, { refused: uploadState.status === "failed" && uploadState.reason === "refused" })
    track("studio_recording_submitted", { source: recording.source, seconds: recording.seconds })
    setStep("topic")
  }

  const topicTitle =
    topicId === OWN_TOPIC_ID ? ownTopic.trim() : (TOPICS.find((t) => t.id === topicId)?.title ?? "")

  // "Make my sample" can be pressed while the upload is still running; the
  // request goes out the moment both files are in. Everything it sends is
  // read here, once, from the submission being uploaded, and the Submit
  // screen is locked meanwhile (nothing to edit, no way back).
  async function makeSample() {
    const plan = uploadPlan.current
    if (!topicTitle || !recording || !photo || !plan || sending) return
    // The header can't reach Submit with a take or photo other than the one
    // uploading (flow-steps.ts); if it ever does, nothing goes out.
    if (!isFor(plan, recording, photo)) {
      console.error("Make my sample with a take or photo that isn't the one uploading")
      setSendError("Submit your recording again first.")
      return
    }
    const request = {
      submissionId: plan.submissionId,
      recordingPath: recordingPath(plan.submissionId, recording),
      photoPath: photoPath(plan.submissionId),
      recordingSeconds: recording.seconds,
      recordingSource: recording.source,
      checks: recording.checks,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      firm: profile.firm,
      topicId: topicId ?? "",
      topicTitle,
      consent: CONSENT_TEXT,
      consentAt: consentAt ?? new Date().toISOString(),
    }
    setSendError(null)
    setSending(true)
    const { complete } = await settlePlan(plan)
    if (!complete || uploadPlan.current !== plan) {
      // The upload banner says what went wrong and offers Retry.
      setSending(false)
      return
    }
    try {
      await submitSampleRequest(request)
      const record = { topicTitle: request.topicTitle, at: new Date().toISOString() }
      rememberSent(record)
      void clearTake()
      void clearPhoto()
      setSent(record)
      track("studio_sample_requested", { topic: request.topicId, source: request.recordingSource })
      setStep("done")
    } catch (error) {
      // Only the API's own message is written for the person; SDK and fetch
      // errors get words of ours.
      console.error("Request failed", error)
      setSendError(error instanceof ApiError ? error.message : describeSubmitError(error))
    } finally {
      setSending(false)
    }
  }

  function startAnother() {
    cancelPlan(uploadPlan.current)
    uploadPlan.current = null
    void clearTake()
    void clearPhoto()
    setRecording((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return null
    })
    setPhoto((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return null
    })
    setConsent(false)
    setTopicId(null)
    setOwnTopic("")
    setUploadState({ status: "idle" })
    setReached(0)
    setStep("photo-guide")
  }

  const name = fullName(profile.firstName, profile.lastName) ?? ""
  const lines = useMemo(() => scriptLines(name, profile.firm), [name, profile.firm])

  // To a camera screen: straight there with the camera on, reopening it if it
  // was allowed before, or through the camera permission step.
  function toCamera(target: CameraFor) {
    setCameraFor(target)
    if (stream) {
      setStep(target)
      return
    }
    if (cameraAllowed.current) {
      void openCamera(target)
      return
    }
    setStep("camera")
  }

  // Where a header step takes you: back to what you made there (the photo,
  // the take), not to its tips again.
  function openStep(i: number) {
    // Off the camera screens, the camera goes off.
    if (i === 0 || i >= 3) stopCamera()
    setTipsOnly(false)
    if (i === 0) setStep("about")
    else if (i === 1) setStep(photo ? "photo-review" : "photo-guide")
    else if (i === 2) setStep(recording ? "review" : "video-guide")
    else setStep(i === 3 ? "topic" : "submit")
  }

  // The back arrow, screen by screen. Recording (full screen) has its own close.
  const back: Partial<Record<Step, () => void>> = {
    "photo-guide": () => setStep(tipsOnly && stream ? "photo" : "about"),
    photo: () => setStep("photo-guide"),
    "photo-review": () => toCamera("photo"),
    camera: () => setStep(cameraFor === "photo" ? "photo-guide" : "video-guide"),
    blocked: () => setStep(cameraFor === "photo" ? "photo-guide" : "video-guide"),
    "video-guide": () => setStep(tipsOnly && stream ? "align" : photo ? "photo-review" : "photo-guide"),
    align: () => setStep("video-guide"),
    review: () => toCamera("align"),
    topic: () => setStep("review"),
    submit: () => setStep("topic"),
  }

  // Steps can't be opened mid-recording, while the request goes out, or once it's sent.
  const busy = step === "countdown" || step === "script" || sending || at === 5
  const headerSteps: HeaderStep[] = STEPS.map((label, i) => {
    const { state, open } = headerStep(i, at, reached, busy)
    return { label, state, onOpen: open ? () => openStep(i) : undefined }
  })
  const header = (
    <StepsHeader
      steps={headerSteps}
      counter={at < 5 ? `Step ${at + 1} of 5` : "Done"}
      onBack={step === "loading" || sending ? undefined : back[step]}
    />
  )

  if (step === "loading") {
    return (
      <Page>
        {header}
        <main className="flex flex-grow items-center justify-center text-[14px] text-stone-500">Loading…</main>
      </Page>
    )
  }

  return (
    <Page>
      {header}

      {step === "about" && (
        <AboutStep
          initial={profile}
          onContinue={(next) => {
            saveProfile(next)
            setProfile(next)
            identify(next.email.toLowerCase(), { name: fullName(next.firstName, next.lastName), firm: next.firm })
            setTipsOnly(false)
            setStep(photo ? "photo-review" : "photo-guide")
          }}
        />
      )}

      {(step === "camera" || step === "blocked") &&
        (step === "camera" ? (
          <CameraAllowStep
            unsupported={!recordingSupported}
            error={cameraError}
            busy={cameraBusy}
            onAllow={() => void openCamera(cameraFor)}
          />
        ) : (
          <CameraBlockedStep onRetry={() => void openCamera(cameraFor)} />
        ))}

      {step === "photo-guide" && (
        <GuideStep key="photo" guide={PHOTO_GUIDE} onDone={() => toCamera("photo")} />
      )}

      {step === "video-guide" && (
        <GuideStep key="video" guide={VIDEO_GUIDE} onDone={() => toCamera("align")} />
      )}

      {step === "photo" && stream && camera && (
        <>
          {photoError && (
            <div className="mx-auto w-full max-w-[560px] px-(--page-pad) pt-4 text-center">
              <ErrorText>{photoError}</ErrorText>
            </div>
          )}
          <AlignStep
            key={photoAttempt}
            stream={stream}
            camera={camera}
            purpose="photo"
            onStart={(result) => void takePhoto(result)}
            onCancel={() => setStep("photo-guide")}
            onTips={() => {
              setTipsOnly(true)
              setStep("photo-guide")
            }}
          />
        </>
      )}

      {step === "photo-review" && photo && (
        <PhotoReviewStep photo={photo} onUse={keepPhoto} onRetake={() => toCamera("photo")} />
      )}

      {step === "align" && stream && camera && (
        <AlignStep
          stream={stream}
          camera={camera}
          purpose="video"
          onStart={startCountdown}
          onCancel={() => setStep("video-guide")}
          onTips={() => {
            setTipsOnly(true)
            setStep("video-guide")
          }}
        />
      )}

      {step === "countdown" && stream && (
        <CountdownStep stream={stream} firstLine={lines[0]} onDone={beginScript} onCancel={() => setStep("align")} />
      )}

      {step === "script" && stream && (
        <>
          {camera && (
            <FaceWatch
              camera={camera}
              onFrame={(frame) => {
                faceFrames.current.total += 1
                if (frame.found) faceFrames.current.found += 1
              }}
            />
          )}
          <ScriptStep
            stream={stream}
            lines={lines}
            speaking={() => recorder.current?.speaking() ?? null}
            level={() => recorder.current?.level() ?? 0}
            onStop={() => void finishRecording()}
            onRestart={restartRecording}
          />
        </>
      )}

      {step === "review" && recording && (
        <ReviewStep
          recording={recording}
          consent={consent}
          onConsent={setConsent}
          error={reviewError}
          notice={reviewNotice}
          onPlayable={(playable) =>
            // Whether this browser could play its own take back travels with
            // the checks, so the team hears about a damaged file.
            setRecording((r) => {
              if (!r) return r
              const checks = markPlayable(r.checks, playable)
              return checks === r.checks ? r : { ...r, checks }
            })
          }
          onSubmit={submitRecording}
          onRedo={() => toCamera("align")}
        />
      )}

      {(step === "topic" || step === "submit") && (
        <UploadBanner state={uploadState} onRetry={retryUpload} />
      )}

      {step === "topic" && (
        <TopicStep
          topicId={topicId}
          ownTopic={ownTopic}
          onTopic={setTopicId}
          onOwnTopic={setOwnTopic}
          canContinue={Boolean(topicTitle)}
          onContinue={() => setStep("submit")}
        />
      )}

      {step === "submit" && recording && photo && (
        <SubmitStep
          photo={photo}
          recording={recording}
          profile={profile}
          topicTitle={topicTitle}
          canSubmit={Boolean(topicTitle) && uploadState.status !== "failed"}
          sending={sending}
          waitingForUpload={sending && uploadState.status === "uploading"}
          error={sendError}
          onSubmit={() => void makeSample()}
          onRetakePhoto={() => openStep(1)}
          onRecordAgain={() => toCamera("align")}
          onChangeTopic={() => setStep("topic")}
          onEditDetails={() => setStep("about")}
        />
      )}

      {step === "done" && (
        <DoneStep email={profile.email} topicTitle={sent?.topicTitle ?? topicTitle} onAnother={startAnother} />
      )}
    </Page>
  )
}

function AboutStep({ initial, onContinue }: { initial: StudioProfile; onContinue: (p: StudioProfile) => void }) {
  const [email, setEmail] = useState(initial.email)
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [firm, setFirm] = useState(initial.firm)
  const [emailError, setEmailError] = useState<string | null>(null)
  const ready = email.trim() && firstName.trim() && lastName.trim() && firm.trim()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    // The same check the server makes, so a typo is caught here, not after recording.
    const valid = asEmail(email)
    if (!valid) {
      setEmailError("Enter a valid email address. We send your sample there.")
      return
    }
    onContinue({ email: valid, firstName: firstName.trim(), lastName: lastName.trim(), firm: firm.trim() })
  }

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-grow flex-wrap items-start gap-10 px-(--page-pad) pt-10 pb-16 sm:gap-14 sm:pt-16">
      <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-8 lg:max-w-[520px]">
        <div className="flex flex-col gap-3">
          <MonoLabel className="text-[#4d5a48]">Your sample video · free</MonoLabel>
          <Display>Tell us about you</Display>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="alex@visaflo.ca"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError(null)
                }}
              />
              {emailError && <ErrorText>{emailError}</ErrorText>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field id="first-name" label="First name" autoComplete="given-name" placeholder="Alex" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Field id="last-name" label="Last name" autoComplete="family-name" placeholder="Kim" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <Field
              id="firm"
              label="Firm name"
              autoComplete="organization"
              placeholder="VisaFlo Immigration"
              value={firm}
              onChange={(e) => setFirm(e.target.value)}
            />
          </div>
          <PrimaryButton type="submit" disabled={!ready} className="self-start px-10">
            Continue
          </PrimaryButton>
        </form>
      </div>
      <WhatsNext />
    </main>
  )
}

const NEXT = [
  { icon: Camera, label: "Take a photo", meta: "A few seconds" },
  { icon: Video, label: "Take a video", meta: "About 30 seconds" },
  { icon: Newspaper, label: "Pick a topic", meta: "This week's news" },
  { icon: Send, label: "Submit", meta: "We email your sample" },
]

function WhatsNext() {
  return (
    <aside aria-label="What to do next" className="flex min-w-0 flex-[1_1_340px] flex-col gap-6 border border-stone-200 bg-stone-50 p-6 sm:p-7">
      <h2 className="m-0 text-[16px] font-semibold">What to do next (about 1 minute)</h2>
      <ul className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
        {NEXT.map(({ icon: Icon, ...row }) => (
          <li key={row.label} className="flex items-center gap-3.5 border-b border-stone-200 py-3.5">
            <Icon className="size-5 shrink-0 text-stone-700" strokeWidth={1.6} aria-hidden />
            <span className="flex-grow text-[16px] font-medium">{row.label}</span>
            <span className="text-right text-[14px] text-stone-600">{row.meta}</span>
          </li>
        ))}
      </ul>
    </aside>
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
                <span className="font-medium">We couldn&apos;t save your photo and video.</span>{" "}
                <span className="text-stone-600">Retry. Still stuck? Email info@vflo.app.</span>
              </span>
            ) : state.reason === "other" ? (
              <span className="flex-grow">
                <span className="font-medium">We couldn&apos;t save your photo and video ({state.code}).</span>{" "}
                <span className="text-stone-600">Retry. Still stuck? Email info@vflo.app.</span>
              </span>
            ) : (
              <span className="flex-grow">
                <span className="font-medium">The upload stopped.</span>{" "}
                <span className="text-stone-600">Check your connection, then press Retry. Keep this page open.</span>
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
            <span className="whitespace-nowrap text-stone-700">Uploading your photo and video</span>
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
  canContinue,
  onContinue,
}: {
  topicId: string | null
  ownTopic: string
  onTopic: (id: string) => void
  onOwnTopic: (value: string) => void
  canContinue: boolean
  onContinue: () => void
}) {
  const options = [...TOPICS, { id: OWN_TOPIC_ID, title: "Something else", detail: "Your own topic" }]
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-grow flex-col gap-7 px-(--page-pad) pt-10 pb-16 sm:pt-12">
      <div className="flex flex-col gap-2.5">
        <Display className="sm:text-[48px]">Pick this week&apos;s topic</Display>
        <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
          We make your sample from the newest IRCC update in the area you pick.
        </p>
      </div>
      <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3 border-0 p-0">
        <legend className="sr-only">Topic for your sample video</legend>
        {options.map((topic) => {
          const selected = topicId === topic.id
          return (
            <label
              key={topic.id}
              className={cn(
                "flex min-h-[92px] cursor-pointer flex-col justify-center gap-1.5 px-[18px] py-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stone-950",
                selected ? "border-2 border-stone-950" : "border border-stone-300 hover:border-stone-500",
              )}
            >
              <input type="radio" name="topic" checked={selected} onChange={() => onTopic(topic.id)} className="sr-only" />
              <span className="font-mono text-[11px] tracking-[0.1em] text-stone-500 uppercase">{topic.detail}</span>
              <span className="text-[17px] leading-[1.35] font-medium">{topic.title}</span>
            </label>
          )
        })}
      </fieldset>
      {topicId === OWN_TOPIC_ID && (
        <Field
          id="own-topic"
          label="Your topic"
          placeholder="e.g. Common reasons visitor visas get refused"
          value={ownTopic}
          maxLength={300}
          onChange={(e) => onOwnTopic(e.target.value)}
          autoFocus
        />
      )}
      <PrimaryButton type="button" disabled={!canContinue} onClick={onContinue} className="self-start px-10">
        Continue
      </PrimaryButton>
    </main>
  )
}

// One look at everything before it goes: the photo, the take, the topic and
// who it's for, each with a way back to change it.
function SubmitStep({
  photo,
  recording,
  profile,
  topicTitle,
  canSubmit,
  sending,
  waitingForUpload,
  error,
  onSubmit,
  onRetakePhoto,
  onRecordAgain,
  onChangeTopic,
  onEditDetails,
}: {
  photo: Photo
  recording: Recording
  profile: StudioProfile
  topicTitle: string
  canSubmit: boolean
  sending: boolean
  waitingForUpload: boolean
  error: string | null
  onSubmit: () => void
  onRetakePhoto: () => void
  onRecordAgain: () => void
  onChangeTopic: () => void
  onEditDetails: () => void
}) {
  // Nothing can change while the request goes out: it was read when Make my
  // sample was pressed.
  const edit =
    "flex h-8 items-center text-[14px] text-stone-600 underline underline-offset-[3px] enabled:hover:text-stone-950 disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-grow flex-col gap-7 px-(--page-pad) pt-10 pb-16 sm:pt-12">
      <div className="flex flex-col gap-2.5">
        <Display className="sm:text-[48px]">Ready to make your sample?</Display>
        <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
          Check everything once. We&apos;ll make it and email you, usually within a day.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col border border-stone-200">
          <div className="aspect-[9/16] max-h-[300px] overflow-hidden bg-stone-900">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise */}
            <img src={photo.url} alt="Your portrait photo" className="size-full -scale-x-100 object-cover" />
          </div>
          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <span className="text-[15px] font-medium">Photo</span>
            <button type="button" onClick={onRetakePhoto} disabled={sending} className={edit}>
              Retake
            </button>
          </div>
        </div>
        <div className="flex flex-col border border-stone-200">
          <div className="aspect-[9/16] max-h-[300px] overflow-hidden bg-stone-900">
            <video src={recording.url} controls playsInline preload="metadata" className="size-full object-cover" />
          </div>
          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <span className="text-[15px] font-medium">Video</span>
            <button type="button" onClick={onRecordAgain} disabled={sending} className={edit}>
              Record again
            </button>
          </div>
        </div>
        <dl className="col-span-2 m-0 flex min-w-0 flex-col gap-4 border border-stone-200 p-5">
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[11px] tracking-[0.1em] text-stone-500 uppercase">Topic</dt>
            <dd className="m-0 text-[17px] font-medium">{topicTitle}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[11px] tracking-[0.1em] text-stone-500 uppercase">You</dt>
            <dd className="m-0 text-[16px]">
              {fullName(profile.firstName, profile.lastName)} · {profile.firm}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[11px] tracking-[0.1em] text-stone-500 uppercase">We email it to</dt>
            <dd className="m-0 text-[16px] break-all">{profile.email}</dd>
          </div>
          <div className="mt-auto flex gap-5">
            <button type="button" onClick={onChangeTopic} disabled={sending} className={edit}>
              Change topic
            </button>
            <button type="button" onClick={onEditDetails} disabled={sending} className={edit}>
              Edit details
            </button>
          </div>
        </dl>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      <PrimaryButton type="button" disabled={!canSubmit || sending} onClick={onSubmit} className="self-start px-10">
        {waitingForUpload ? "Finishing upload…" : sending ? "Sending…" : "Make my sample"}
      </PrimaryButton>
    </main>
  )
}

function DoneRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 border-b border-stone-200 py-4">
      <span className="flex size-8 shrink-0 items-center justify-center bg-[#eef0e9]">
        <DoneMark className="size-4 stroke-[#3a4536]" />
      </span>
      {children}
    </li>
  )
}

function DoneStep({ email, topicTitle, onAnother }: { email: string; topicTitle: string; onAnother: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-grow flex-wrap items-start gap-10 px-(--page-pad) pt-12 pb-16 sm:gap-14 sm:pt-20">
      <div className="flex flex-[1_1_380px] flex-col gap-4">
        <Display>Your sample is in the works</Display>
        <p className="m-0 text-[18px] leading-[1.5] text-stone-600">
          We&apos;ll email <span className="font-medium text-stone-950">{email}</span> when it&apos;s ready.
        </p>
      </div>
      <div className="flex flex-[1_1_380px] flex-col gap-7">
        <ol className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
          <DoneRow>
            <span className="text-[16px] font-medium">Portrait photo</span>
          </DoneRow>
          <DoneRow>
            <span className="text-[16px] font-medium">Portrait video</span>
          </DoneRow>
          <DoneRow>
            <span className="flex flex-col gap-0.5">
              <span className="text-[16px] font-medium">Topic</span>
              {topicTitle && <span className="text-[14px] text-stone-600">{topicTitle}</span>}
            </span>
          </DoneRow>
          <DoneRow>
            <span className="text-[16px] font-medium">Submitted</span>
          </DoneRow>
          <li className="flex items-center gap-3.5 border-b border-stone-200 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center bg-stone-950 font-mono text-[14px] text-white" aria-hidden>
              →
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[16px] font-medium">Your sample</span>
              <span className="text-[14px] text-stone-600">In progress · usually within a day</span>
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
