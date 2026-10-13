import type { RecordingChecks } from "@/lib/studio/checks"

// The one account that can open /admin and see every Studio submission. The
// same email is in docs/studio-capture/storage.rules (which compares it
// exactly, so keep it lower-case), docs/studio-capture/rules-test.mjs and
// the README: change all four together. The tests import it from here.
export const STUDIO_ADMIN_EMAIL = "bkim@vflo.app"

export function isStudioAdmin(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === STUDIO_ADMIN_EMAIL
}

// The `code` /api/admin/* answers with when the admin's email isn't verified
// yet; the pages show the "Send verification email" panel on it instead of
// an error. One constant for both sides of the wire.
export const UNVERIFIED_CODE = "unverified"

export type SubmissionProblem = {
  kind: "no-recording" | "no-token" | "meta-unreadable" | "request-unreadable"
  detail?: string
}

export type Submission = {
  /** `{uid}/{submissionId}`, the folder under studio/. */
  id: string
  uid: string
  submissionId: string
  /**
   * "requested": request.json was read and names a topic (team emailed).
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
   * and needs a download token; the download route needs only `name`.
   * `contentType` and `bytes` come from the object metadata when readable.
   */
  recording?: { name: string; url?: string; contentType?: string; bytes?: number }
  consoleUrl: string
  /** Parts of the folder that are missing or couldn't be read; empty when all is well. */
  problems: SubmissionProblem[]
}
