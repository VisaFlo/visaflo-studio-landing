import type { Submission, SubmissionProblem } from "@/lib/studio/admin"
import { isPlainObject } from "@/lib/studio/checks"
import { RECORDING_EXTENSIONS } from "@/lib/studio/project"
import { asEmail, readRequestJson, seconds, type RequestJson } from "@/lib/studio/request-json"
import { consoleUrl, firstDownloadToken, mediaUrl, StorageError, type StudioBucket } from "@/lib/studio/storage"

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

const RECORDING = new RegExp(`/recording\\.(${RECORDING_EXTENSIONS.join("|")})$`)

// The recording.<ext> object in a folder listing.
export function recordingObject(items: string[]): string | undefined {
  return items.find((name) => RECORDING.test(name))
}

// What a downloaded recording is called: the person (name, else email, else
// uid, each reduced to [a-z0-9-] so the header stays plain), the submission,
// and the recording's own extension (mp4 when it has none). `ref` has been
// through parseSubmissionId, so its halves are header-safe already.
export function downloadName(who: Pick<RequestJson, "name" | "email">, ref: SubmissionRef, objectName: string): string {
  const slug = (value?: string) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const person = slug(who.name) || slug(who.email) || ref.uid || "recording"
  const ext = /\.(\w+)$/.exec(objectName)?.[1] ?? "mp4"
  return `${person}-${ref.submissionId}.${ext}`
}

async function readSubmission(bucket: StudioBucket, ref: SubmissionRef, items: string[]): Promise<Submission> {
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

  // A refused read is about the server's credentials, not this file: let the
  // route say so once instead of every row saying "read problem".
  const unreadable = (kind: SubmissionProblem["kind"], what: string) => (error: unknown) => {
    if (error instanceof StorageError && error.refused) throw error
    console.error(`Could not read ${what} in ${folder}`, error)
    submission.problems.push({ kind, detail: error instanceof Error ? error.message : String(error) })
    return undefined
  }

  // readRequestJson turns anything that isn't an object into {}, which would
  // read here as "no topic"; name the real shape instead.
  const asObject = (raw: unknown): RequestJson => {
    if (isPlainObject(raw)) return readRequestJson(raw)
    throw new Error(`request.json is ${Array.isArray(raw) ? "an array" : raw === null ? "null" : `a ${typeof raw}`}, not an object`)
  }

  const [meta, details] = await Promise.all([
    recording ? bucket.meta(recording).catch(unreadable("meta-unreadable", "the recording's metadata")) : undefined,
    request ? bucket.json(request).then(asObject).catch(unreadable("request-unreadable", "request.json")) : undefined,
  ])

  if (recording) submission.recording = { name: recording }
  else submission.problems.push({ kind: "no-recording" })
  if (submission.recording && meta) {
    submission.recordedAt = meta.timeCreated
    // The uploader's browser wrote these; same guards as request.json.
    submission.email = asEmail(meta.metadata?.email)
    submission.seconds = seconds(meta.metadata?.seconds)
    if (meta.contentType) submission.recording.contentType = meta.contentType
    const bytes = Number(meta.size)
    if (Number.isFinite(bytes) && bytes > 0) submission.recording.bytes = bytes
    const downloadToken = firstDownloadToken(meta)
    if (downloadToken) submission.recording.url = mediaUrl(submission.recording.name, downloadToken)
    else submission.problems.push({ kind: "no-token" })
  }
  if (details) {
    // The route refuses a request without a topic, so one here was never a
    // finished request; say so rather than call it "topic picked".
    if (details.topicTitle) submission.status = "requested"
    else submission.problems.push({ kind: "request-unreadable", detail: "no topicTitle" })
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
  if (submission.status !== "requested" && submission.problems.some((p) => p.kind === "request-unreadable")) {
    submission.status = "request-unreadable"
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
export async function loadSubmission(bucket: StudioBucket, ref: SubmissionRef): Promise<Submission | null> {
  const { items } = await bucket.list(`${submissionFolder(ref)}/`)
  if (!items.length) return null
  return readSubmission(bucket, ref, items)
}

// Every studio/{uid}/{submissionId}/ folder, newest first.
export async function loadSubmissions(bucket: StudioBucket): Promise<Submission[]> {
  const people = await bucket.list("studio/")
  const folders = (await inBatches(people.prefixes, 10, (prefix) => bucket.list(prefix))).flatMap((l) => l.prefixes)
  const refs = folders.flatMap((prefix) => {
    const ref = parseSubmissionId(prefix.replace(/^studio\//, "").replace(/\/$/, ""))
    if (!ref) console.error(`Skipping a folder that isn't studio/{uid}/{submissionId}/: ${prefix}`)
    return ref ? [ref] : []
  })
  const submissions = await inBatches(refs, 10, async (ref) => readSubmission(bucket, ref, (await bucket.list(`${submissionFolder(ref)}/`)).items))
  const at = (s: Submission) => s.requestedAt ?? s.recordedAt ?? ""
  return submissions.sort((a, b) => at(b).localeCompare(at(a)))
}
