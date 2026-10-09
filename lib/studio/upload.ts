"use client"

import type { User } from "firebase/auth"
import { ref, uploadBytes, uploadBytesResumable, type UploadTask } from "firebase/storage"

import { studioStorage } from "@/lib/studio/firebase"
import { extensionFor, type Recording } from "@/lib/studio/recorder"

// Everything for one sample lives under studio/{uid}/{submissionId}/ in the
// VisaFlo bucket. The storage rules let a signed-in person write only under
// their own uid, and nobody read from a browser.
export function submissionFolder(uid: string, submissionId: string): string {
  return `studio/${uid}/${submissionId}`
}

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
  user: User,
  submissionId: string,
  recording: Recording,
  onProgress: (fraction: number) => void,
): UploadHandle {
  const path = `${submissionFolder(user.uid, submissionId)}/recording.${extensionFor(recording.mime)}`
  const task: UploadTask = uploadBytesResumable(ref(studioStorage(), path), recording.blob, {
    contentType: recording.mime.split(";")[0],
    customMetadata: {
      email: user.email ?? "",
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
  checks?: Recording["checks"]
  name: string
  firm: string
  topicId: string
  topicTitle: string
  consent: string
  consentAt: string
}

// The request is kept next to the recording (so the bucket alone has the full
// record) and sent to the team inbox through our API.
export async function submitSampleRequest(user: User, request: SampleRequest): Promise<void> {
  const json = JSON.stringify({ ...request, uid: user.uid, email: user.email, createdAt: new Date().toISOString() }, null, 2)
  await uploadBytes(
    ref(studioStorage(), `${submissionFolder(user.uid, request.submissionId)}/request.json`),
    new Blob([json], { type: "application/json" }),
    { contentType: "application/json" },
  )

  const response = await fetch("/api/studio/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(request),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
}

const doneKey = (uid: string) => `vf_studio_request:${uid}`

export type SentRequest = { topicTitle: string; at: string }

export function rememberSent(uid: string, sent: SentRequest) {
  try {
    localStorage.setItem(doneKey(uid), JSON.stringify(sent))
  } catch {}
}

export function lastSent(uid: string): SentRequest | null {
  try {
    return JSON.parse(localStorage.getItem(doneKey(uid)) ?? "null") as SentRequest | null
  } catch {
    return null
  }
}
