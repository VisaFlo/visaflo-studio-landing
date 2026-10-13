import type { Submission, SubmissionProblem } from "@/lib/studio/admin"
import { parseChecks, type RecordingChecks } from "@/lib/studio/checks"
import { consoleUrl, firstDownloadToken, listObjects, mediaUrl, storageJson, storageMeta, StorageError } from "@/lib/studio/storage"

export { StorageError }

export type SubmissionRef = { uid: string; submissionId: string }

// Both halves are single path segments (the same shape lib/studio/return-path.ts
// accepts in /admin URLs), so nothing can point outside studio/.
const SEGMENT = /^[\w-]+$/

// "uid/submissionId" as the admin pages send it.
export function parseSubmissionId(id: unknown): SubmissionRef | null {
  if (typeof id !== "string") return null
  const parts = id.split("/")
  if (parts.length !== 2 || !parts.every((p) => SEGMENT.test(p))) return null
  return { uid: parts[0], submissionId: parts[1] }
}

export function submissionFolder(ref: SubmissionRef): string {
  return `studio/${ref.uid}/${ref.submissionId}`
}

// The recording.<ext> object in a folder listing: mp4 or webm from
// MediaRecorder (the rules also allow mov and m4v).
export function recordingObject(items: string[]): string | undefined {
  return items.find((name) => /\/recording\.\w+$/.test(name))
}

export type RequestJson = {
  email?: string
  name?: string
  firm?: string
  topicTitle?: string
  recordingSeconds?: number
  checks?: RecordingChecks
  consent?: string
  consentAt?: string
  createdAt?: string
}

const MAX_TEXT = 200
const str = (value: unknown, max = MAX_TEXT): string | undefined =>
  typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined

// request.json is written by the person's own browser under their own uid,
// so it is read field by field, never cast: a non-string where the page
// expects text would otherwise crash the admin page for that submission.
export function readRequestJson(raw: unknown): RequestJson {
  if (!raw || typeof raw !== "object") return {}
  const v = raw as Record<string, unknown>
  const out: RequestJson = {}
  const put = <K extends keyof RequestJson>(key: K, value: RequestJson[K] | undefined) => {
    if (value !== undefined) out[key] = value
  }
  put("email", str(v.email))
  put("name", str(v.name))
  put("firm", str(v.firm))
  put("topicTitle", str(v.topicTitle, 500))
  const seconds = Number(v.recordingSeconds)
  if (Number.isFinite(seconds) && seconds > 0) out.recordingSeconds = Math.round(seconds)
  put("checks", parseChecks(v.checks))
  put("consent", str(v.consent, 2000))
  put("consentAt", str(v.consentAt, 40))
  put("createdAt", str(v.createdAt, 40))
  return out
}

// What a downloaded recording is called: the person (name, else email, else
// uid, each reduced to [a-z0-9-] so the header stays plain), the submission,
// and the recording's own extension (mp4 when it has none).
export function downloadName(s: { name?: string; email?: string; uid: string; submissionId: string }, objectName: string): string {
  const slug = (value?: string) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const who = slug(s.name) || slug(s.email) || s.uid.replace(/[^\w-]/g, "") || "recording"
  const ext = /\.(\w+)$/.exec(objectName)?.[1] ?? "mp4"
  return `${who}-${s.submissionId}.${ext}`
}

const PROBLEM_TEXT: Record<SubmissionProblem["kind"], string> = {
  "no-recording": "No recording file in this folder",
  "no-token": "The recording has no download token; open it in the Firebase console",
  "meta-unreadable": "The recording's metadata couldn't be read",
  "request-unreadable": "request.json couldn't be read",
}

export function describeProblems(problems: SubmissionProblem[]): string {
  return problems.map((p) => (p.detail ? `${PROBLEM_TEXT[p.kind]} (${p.detail})` : PROBLEM_TEXT[p.kind])).join("; ")
}

async function readSubmission(token: string, ref: SubmissionRef, items: string[]): Promise<Submission> {
  const folder = submissionFolder(ref)
  const submission: Submission = {
    id: `${ref.uid}/${ref.submissionId}`,
    uid: ref.uid,
    submissionId: ref.submissionId,
    status: "recorded",
    consoleUrl: consoleUrl(folder),
    problems: [],
  }
  const recording = recordingObject(items)
  const request = items.find((name) => name.endsWith("/request.json"))

  // A refused read is about the token or the rules, not this file: let the
  // route say so once instead of every row saying "read problem".
  const unreadable = (kind: SubmissionProblem["kind"], what: string) => (error: unknown) => {
    if (error instanceof StorageError && (error.status === 401 || error.status === 403)) throw error
    console.error(`Could not read ${what} in ${folder}`, error)
    submission.problems.push({ kind, detail: error instanceof Error ? error.message : String(error) })
    return undefined
  }

  const [meta, details] = await Promise.all([
    recording ? storageMeta(token, recording).catch(unreadable("meta-unreadable", "the recording's metadata")) : undefined,
    request ? storageJson<unknown>(token, request).then(readRequestJson).catch(unreadable("request-unreadable", "request.json")) : undefined,
  ])

  if (!recording) submission.problems.push({ kind: "no-recording" })
  if (recording && meta) {
    submission.recordedAt = meta.timeCreated
    submission.email = meta.metadata?.email || undefined
    submission.seconds = Number(meta.metadata?.seconds) || undefined
    const downloadToken = firstDownloadToken(meta)
    if (downloadToken) {
      submission.video = { url: mediaUrl(recording, downloadToken), contentType: meta.contentType ?? "video/mp4", bytes: Number(meta.size) || 0 }
    } else {
      submission.problems.push({ kind: "no-token" })
    }
  }
  if (details) {
    submission.status = "requested"
    submission.requestedAt = details.createdAt
    submission.email = details.email ?? submission.email
    submission.name = details.name
    submission.firm = details.firm
    submission.topicTitle = details.topicTitle
    submission.seconds = details.recordingSeconds ?? submission.seconds
    submission.checks = details.checks
    submission.consent = details.consent
    submission.consentAt = details.consentAt
  }
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

// One submission for its own page; null when the folder has nothing in it.
export async function loadSubmission(token: string, ref: SubmissionRef): Promise<Submission | null> {
  const { items } = await listObjects(token, `${submissionFolder(ref)}/`)
  if (!items.length) return null
  return readSubmission(token, ref, items)
}

// Every studio/{uid}/{submissionId}/ folder, newest first.
export async function loadSubmissions(token: string): Promise<Submission[]> {
  const people = await listObjects(token, "studio/")
  const folders = (await inBatches(people.prefixes, 10, (prefix) => listObjects(token, prefix))).flatMap((l) => l.prefixes)
  const refs = folders.flatMap((prefix) => {
    const ref = parseSubmissionId(prefix.replace(/^studio\//, "").replace(/\/$/, ""))
    if (!ref) console.error(`Skipping a folder that isn't studio/{uid}/{submissionId}/: ${prefix}`)
    return ref ? [ref] : []
  })
  const submissions = await inBatches(refs, 10, async (ref) => readSubmission(token, ref, (await listObjects(token, `${submissionFolder(ref)}/`)).items))
  const at = (s: Submission) => s.requestedAt ?? s.recordedAt ?? ""
  return submissions.sort((a, b) => at(b).localeCompare(at(a)))
}
