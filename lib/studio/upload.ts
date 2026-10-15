"use client"

import { ref, uploadBytes, uploadBytesResumable, type UploadTask } from "firebase/storage"

import { apiError } from "@/lib/studio/errors"
import { studioStorage } from "@/lib/studio/firebase"
import { PHOTO_MIME } from "@/lib/studio/photo"
import { photoPath, recordingPath } from "@/lib/studio/paths"
import type { Recording } from "@/lib/studio/recorder"

export { newSubmissionId, photoPath, recordingPath } from "@/lib/studio/paths"

// The photo is small, so one request. The rules refuse a second upload of
// either file to the same submission (see upload-plan.ts).
export async function uploadPhoto(email: string, submissionId: string, photo: Blob): Promise<void> {
  await uploadBytes(ref(studioStorage(), photoPath(submissionId)), photo, { contentType: PHOTO_MIME, customMetadata: { email } })
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
  const path = recordingPath(submissionId, recording)
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
  photoPath: string
  email: string
  firstName: string
  lastName: string
  firm: string
  topicId: string
  topicTitle: string
  consent: string
  consentAt: string
}

// The server checks the recording (and the photo, when sent) are in the
// bucket, keeps the request as request.json next to them and emails the team.
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
