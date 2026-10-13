import type { RecordingChecks } from "@/lib/studio/checks"

// The one account that can open /admin and see every Studio submission. The
// same email is in docs/studio-capture/storage.rules (which compares it
// exactly, so keep it lower-case), docs/studio-capture/rules-test.mjs and
// the README: change all four together.
export const STUDIO_ADMIN_EMAIL = "bkim@vflo.app"

export function isStudioAdmin(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === STUDIO_ADMIN_EMAIL
}

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
   * "requested": request.json was read (topic picked, team emailed).
   * "recorded": only the recording is there (no topic yet), or request.json
   * couldn't be read (then `problems` says so).
   */
  status: "requested" | "recorded"
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
  video?: { url: string; contentType: string; bytes: number }
  consoleUrl: string
  /** Parts of the folder that are missing or couldn't be read; empty when all is well. */
  problems: SubmissionProblem[]
}
