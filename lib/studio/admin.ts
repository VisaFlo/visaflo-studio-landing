// The one account that can open /admin and see every Studio submission. The
// storage rules (docs/studio-capture/storage.rules) name the same email, so
// change both together.
export const STUDIO_ADMIN_EMAIL = "bkim@vflo.app"

export function isStudioAdmin(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === STUDIO_ADMIN_EMAIL
}

export type Submission = {
  /** `{uid}/{submissionId}`, the folder under studio/. */
  id: string
  uid: string
  submissionId: string
  /** Recorded and uploaded, but no topic picked yet (no request.json). */
  status: "requested" | "recorded"
  recordedAt?: string
  requestedAt?: string
  email?: string
  name?: string
  firm?: string
  topicTitle?: string
  seconds?: number
  checks?: { faceSeen: boolean; voiceHeard: boolean; headTurn: boolean }
  consent?: string
  consentAt?: string
  video?: { url: string; contentType: string; bytes: number }
  consoleUrl: string
  /** Set when part of the folder couldn't be read. */
  problem?: string
}
