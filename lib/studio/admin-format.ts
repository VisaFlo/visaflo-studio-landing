import type { Submission, SubmissionProblem } from "@/lib/studio/admin"

// Small formatters shared by the admin list and the submission page. Nothing
// here touches Storage, so the client bundle can import it.

// The team reads these in Vancouver, whatever machine opens the page.
export function when(iso?: string): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—"
  return new Date(iso).toLocaleString("en-CA", { timeZone: "America/Vancouver", dateStyle: "medium", timeStyle: "short" })
}

export function clipLength(seconds?: number): string {
  if (!seconds) return "—"
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Type and size as the metadata gave them, with no made-up defaults.
export function fileInfo(recording: Submission["recording"]): string {
  const parts = [recording?.contentType, recording?.bytes !== undefined ? megabytes(recording.bytes) : undefined].filter(Boolean)
  return parts.length ? parts.join(", ") : "—"
}

export function submissionHref(id: string): string {
  return `/admin/${id}`
}

// What the Topic cell says when there is no topic.
export function topicFallback(status: Submission["status"]): string {
  return status === "request-unreadable" ? "Couldn't read request.json" : "No topic picked yet"
}

const PROBLEM_TEXT: Record<SubmissionProblem["kind"], string> = {
  "no-recording": "No recording file in this folder",
  "no-token": "The recording has no download token, so it can't play here; use Download video",
  "meta-unreadable": "The recording's metadata couldn't be read",
  "request-unreadable": "request.json couldn't be read",
}

export function describeProblems(problems: SubmissionProblem[]): string {
  return problems.map((p) => (p.detail ? `${PROBLEM_TEXT[p.kind]} (${p.detail})` : PROBLEM_TEXT[p.kind])).join("; ")
}
