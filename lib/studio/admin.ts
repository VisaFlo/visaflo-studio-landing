import type { RecordingChecks } from "@/lib/studio/checks"

export type SubmissionProblem = {
  kind: "no-recording" | "no-token" | "meta-unreadable" | "request-unreadable"
  detail?: string
}

export type Submission = {
  /** The submission id, the folder under studio/. */
  id: string
  /** The VisaFlo account of a submission from before /start dropped sign-in. */
  uid?: string
  /**
   * "requested": request.json was read and names a topic (the browser then
   * asks /api/studio/requests to email the team).
   * "recorded": only the recording is there, no request.json yet.
   * "request-unreadable": request.json exists but couldn't be read or has no
   * topic; `problems` has the detail.
   */
  status: "requested" | "recorded" | "request-unreadable"
  recordedAt?: string
  requestedAt?: string
  email?: string
  name?: string
  firm?: string
  topicTitle?: string
  seconds?: number
  checks?: RecordingChecks
  consent?: string
  consentAt?: string
  /**
   * The recording file, when the folder has one. `url` plays it in the page
   * and needs a download token; the Download button needs only that a
   * recording exists (the route finds the file itself from the submission
   * id, with the admin's token). `contentType` and `bytes` come from the
   * object metadata when readable.
   */
  recording?: { name: string; url?: string; contentType?: string; bytes?: number }
  /** The portrait photo (photo.jpg), when the folder has one; `url` opens it, like the recording's. */
  photo?: { name: string; url?: string }
  consoleUrl: string
  /** Parts of the folder that are missing or couldn't be read; empty when all is well. */
  problems: SubmissionProblem[]
}
