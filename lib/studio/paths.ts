import { PHOTO_FILE, type RecordingExtension } from "@/lib/studio/project"

// Everything for one sample lives under studio/{submissionId}/ in the
// VisaFlo bucket. Nobody signs in on /start: the storage rules let a browser
// create the portrait photo and the recording there and nothing else (no
// overwrite, no reading); the server writes request.json next to them
// (app/api/studio/requests). The browser builds these paths and the server
// checks them, so both read them from here.
export function submissionFolder(submissionId: string): string {
  return `studio/${submissionId}`
}

// The UTC time to the second, then 8 hex characters: SUBMISSION_ID in
// lib/studio/project.ts, which the rules and the server check.
export function newSubmissionId(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)
  return `${stamp}-${crypto.randomUUID().slice(0, 8)}`
}

export function photoPath(submissionId: string): string {
  return `${submissionFolder(submissionId)}/${PHOTO_FILE}`
}

// recording.<ext>, the extension from the recorder's type (mp4, webm, …).
export function recordingPath(submissionId: string, recording: { mime: string }): string {
  return `${submissionFolder(submissionId)}/recording.${extensionFor(recording.mime)}`
}

// The file name the upload gets: only what the storage rules accept.
export function extensionFor(mime: string): RecordingExtension {
  if (mime.includes("mp4")) return "mp4"
  if (mime.includes("quicktime")) return "mov"
  if (mime.includes("x-m4v")) return "m4v"
  return "webm"
}
