"use client"

import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage"

import { apiError } from "@/lib/studio/errors"
import { studioStorage } from "@/lib/studio/firebase"
import { extensionFor, type Recording } from "@/lib/studio/recorder"

// Everything for one sample lives under studio/{submissionId}/ in the
// VisaFlo bucket. Nobody signs in on /start: the storage rules let a browser
// create the recording there and nothing else (no overwrite, no reading);
// the server writes request.json next to it (app/api/studio/requests).
export function submissionFolder(submissionId: string): string {
  return `studio/${submissionId}`
}

// The UTC time to the second, then 8 hex characters: SUBMISSION_ID in
// lib/studio/project.ts, which the rules and the server check.
export function newSubmissionId(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)
  return `${stamp}-${crypto.randomUUID().slice(0, 8)}`
}

export type UploadHandle = {
  path: string
  done: Promise<void>
  cancel: () => void
}

export function uploadRecording(
  email: string,
  submissionId: string,
  recording: Recording,
  onProgress: (fraction: number) => void,
): UploadHandle {
  const path = `${submissionFolder(submissionId)}/recording.${extensionFor(recording.mime)}`
  const task: UploadTask = uploadBytesResumable(ref(studioStorage(), path), recording.blob, {
    contentType: recording.mime.split(";")[0],
    customMetadata: {
      email,
      source: recording.source,
      seconds: String(recording.seconds),
    },
  })
  const done = new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(),
    )
  })
  return { path, done, cancel: () => task.cancel() }
}

export type SampleRequest = {
  submissionId: string
  recordingPath: string
  recordingSeconds: number
  recordingSource: Recording["source"]
  checks: Recording["checks"]
  email: string
  firstName: string
  lastName: string
  firm: string
  topicId: string
  topicTitle: string
  consent: string
  consentAt: string
}

// The server checks the recording is in the bucket, keeps the request as
// request.json next to it and emails the team.
export async function submitSampleRequest(request: SampleRequest): Promise<void> {
  const response = await fetch("/api/studio/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw apiError("/api/studio/requests", response.status, await response.text())
}

const DONE_KEY = "vf_studio_request"

export type SentRequest = { topicTitle: string; at: string }

export function rememberSent(sent: SentRequest) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify(sent))
  } catch {}
}

export function lastSent(): SentRequest | null {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "null") as SentRequest | null
  } catch {
    return null
  }
}
