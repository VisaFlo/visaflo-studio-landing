import type { Submission, SubmissionProblem } from "@/lib/studio/admin"
import { isPlainObject } from "@/lib/studio/checks"
import { RECORDING_EXTENSIONS, SUBMISSION_ID } from "@/lib/studio/project"
import { asEmail, readRequestJson, seconds, type RequestJson } from "@/lib/studio/request-json"
import { consoleUrl, firstDownloadToken, mediaUrl, StorageError, type StudioBucket } from "@/lib/studio/storage"

// The submission id as the admin pages send it. Only the exact shape
// newSubmissionId makes, so nothing can point outside studio/ (the same
// shape lib/studio/return-path.ts accepts in /admin URLs).
export function parseSubmissionId(id: unknown): string | null {
  return typeof id === "string" && SUBMISSION_ID.test(id) ? id : null
}

export function submissionFolder(submissionId: string): string {
  return `studio/${submissionId}`
}

const RECORDING = new RegExp(`/recording\\.(${RECORDING_EXTENSIONS.join("|")})$`)

// The recording.<ext> object in a folder listing.
export function recordingObject(items: string[]): string | undefined {
  return items.find((name) => RECORDING.test(name))
}

// What a downloaded recording or photo is called: the person (name, else
// email, each reduced to [a-z0-9-] so the header stays plain; else the file's
// own name, "recording" or "photo"), the submission, and the file's own
// extension (mp4 when it has none). `submissionId` has been through
// parseSubmissionId, so it is header-safe already.
export function downloadName(who: Pick<RequestJson, "name" | "email">, submissionId: string, objectName: string): string {
  const slug = (value?: string) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const person = slug(who.name) || slug(who.email) || slug(/([^/.]+)(\.\w+)?$/.exec(objectName)?.[1]) || "recording"
  const ext = /\.(\w+)$/.exec(objectName)?.[1] ?? "mp4"
  return `${person}-${submissionId}.${ext}`
}

async function readSubmission(bucket: StudioBucket, submissionId: string, items: string[]): Promise<Submission> {
  const folder = submissionFolder(submissionId)
  const submission: Submission = {
    id: submissionId,
    status: "recorded",
    consoleUrl: consoleUrl(folder),
    problems: [],
  }
  const recording = recordingObject(items)
  const photo = items.find((name) => name.endsWith("/photo.jpg"))
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

  const [meta, details, photoMeta] = await Promise.all([
    recording ? bucket.meta(recording).catch(unreadable("meta-unreadable", "the recording's metadata")) : undefined,
    request ? bucket.json(request).then(asObject).catch(unreadable("request-unreadable", "request.json")) : undefined,
    // Only the link depends on this; a photo whose metadata can't be read is
    // still listed (and downloadable from the console).
    photo
      ? bucket.meta(photo).catch((error: unknown) => {
          if (error instanceof StorageError && error.refused) throw error
          console.error(`Could not read the photo's metadata in ${folder}`, error)
          return undefined
        })
      : undefined,
  ])

  if (photo) {
    const token = photoMeta ? firstDownloadToken(photoMeta) : undefined
    submission.photo = token ? { name: photo, url: mediaUrl(photo, token) } : { name: photo }
  }

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
    submission.uid = details.uid
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
export async function loadSubmission(bucket: StudioBucket, submissionId: string): Promise<Submission | null> {
  const { items } = await bucket.list(`${submissionFolder(submissionId)}/`)
  if (!items.length) return null
  return readSubmission(bucket, submissionId, items)
}

// Every studio/{submissionId}/ folder, newest first.
export async function loadSubmissions(bucket: StudioBucket): Promise<Submission[]> {
  const { prefixes } = await bucket.list("studio/")
  const ids = prefixes.flatMap((prefix) => {
    const id = parseSubmissionId(prefix.replace(/^studio\//, "").replace(/\/$/, ""))
    if (!id) console.error(`Skipping a folder that isn't studio/{submissionId}/: ${prefix}`)
    return id ? [id] : []
  })
  const submissions = await inBatches(ids, 10, async (id) => readSubmission(bucket, id, (await bucket.list(`${submissionFolder(id)}/`)).items))
  const at = (s: Submission) => s.requestedAt ?? s.recordedAt ?? ""
  return submissions.sort((a, b) => at(b).localeCompare(at(a)))
}
