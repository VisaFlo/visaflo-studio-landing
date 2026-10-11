import type { Submission } from "@/lib/studio/admin"
import { consoleUrl, listObjects, mediaUrl, storageGet, StorageError, type ObjectMeta } from "@/lib/studio/storage"

export { StorageError }

type RequestJson = {
  email?: string
  name?: string
  firm?: string
  topicTitle?: string
  recordingSeconds?: number
  checks?: Submission["checks"]
  consent?: string
  consentAt?: string
  createdAt?: string
}

const encode = (name: string) => encodeURIComponent(name)
const SEGMENT = /^[\w-]+$/

// "uid/submissionId" as the admin pages send it. Both halves are single path
// segments, so nothing can point outside studio/.
export function parseSubmissionId(id: unknown): { uid: string; submissionId: string } | null {
  if (typeof id !== "string") return null
  const parts = id.split("/")
  if (parts.length !== 2 || !parts.every((p) => SEGMENT.test(p))) return null
  return { uid: parts[0], submissionId: parts[1] }
}

// The recording.{mp4,webm} object in a submission folder's listing.
export function recordingObject(items: string[]): string | undefined {
  return items.find((name) => /\/recording\.\w+$/.test(name))
}

// What a downloaded recording is called: the person (name, else email, else
// uid), the submission, and the recording's own extension.
export function downloadName(s: { name?: string; email?: string; uid?: string; submissionId: string }, objectName: string): string {
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const who = s.name?.trim() ? slug(s.name) : s.email?.trim() ? slug(s.email) : s.uid?.trim() || "recording"
  const ext = /\.(\w+)$/.exec(objectName)?.[1] ?? "mp4"
  return `${who}-${s.submissionId}.${ext}`
}

async function readSubmission(token: string, folder: string, items: string[]): Promise<Submission> {
  const [, uid, submissionId] = folder.split("/")
  const submission: Submission = {
    id: `${uid}/${submissionId}`,
    uid,
    submissionId,
    status: "recorded",
    consoleUrl: consoleUrl(folder),
  }
  const recording = recordingObject(items)
  const request = items.find((name) => name.endsWith("/request.json"))
  const problems: string[] = []

  const [meta, details] = await Promise.all([
    recording
      ? storageGet(token, `/${encode(recording)}`)
          .then((r) => r.json() as Promise<ObjectMeta>)
          .catch((error: unknown) => void problems.push(`recording metadata: ${String(error)}`))
      : undefined,
    request
      ? storageGet(token, `/${encode(request)}?alt=media`)
          .then((r) => r.json() as Promise<RequestJson>)
          .catch((error: unknown) => void problems.push(`request.json: ${String(error)}`))
      : undefined,
  ])

  if (!recording) problems.push("no recording file in this folder")
  if (meta) {
    submission.recordedAt = meta.timeCreated
    submission.email = meta.metadata?.email || undefined
    submission.seconds = Number(meta.metadata?.seconds) || undefined
    const downloadToken = meta.downloadTokens?.split(",")[0]
    if (recording && downloadToken) {
      submission.video = {
        url: mediaUrl(recording, downloadToken),
        contentType: meta.contentType ?? "video/mp4",
        bytes: Number(meta.size) || 0,
      }
    } else if (recording) {
      problems.push("recording has no download token; open it in the Firebase console")
    }
  }
  if (details) {
    submission.status = "requested"
    submission.requestedAt = details.createdAt
    submission.email = details.email || submission.email
    submission.name = details.name || undefined
    submission.firm = details.firm || undefined
    submission.topicTitle = details.topicTitle || undefined
    submission.seconds = details.recordingSeconds || submission.seconds
    submission.checks = details.checks
    submission.consent = details.consent
    submission.consentAt = details.consentAt
  }
  if (problems.length) submission.problem = problems.join("; ")
  return submission
}

// Runs `work` over `inputs` a few at a time, so a long list doesn't open
// hundreds of requests at once.
async function inBatches<T, R>(inputs: T[], size: number, work: (input: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < inputs.length; i += size) {
    results.push(...(await Promise.all(inputs.slice(i, i + size).map(work))))
  }
  return results
}

// One submission by "uid/submissionId", for its own page.
export async function loadSubmission(token: string, uid: string, submissionId: string): Promise<Submission> {
  const folder = `studio/${uid}/${submissionId}`
  return readSubmission(token, folder, (await listObjects(token, `${folder}/`)).items)
}

// Every studio/{uid}/{submissionId}/ folder, newest first.
export async function loadSubmissions(token: string): Promise<Submission[]> {
  const people = await listObjects(token, "studio/")
  const folders = (await inBatches(people.prefixes, 10, (prefix) => listObjects(token, prefix))).flatMap((l) => l.prefixes)
  const submissions = await inBatches(folders, 10, async (prefix) => {
    const folder = prefix.replace(/\/$/, "")
    return readSubmission(token, folder, (await listObjects(token, prefix)).items)
  })
  const at = (s: Submission) => s.requestedAt ?? s.recordedAt ?? ""
  return submissions.sort((a, b) => at(b).localeCompare(at(a)))
}
