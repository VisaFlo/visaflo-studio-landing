import type { Submission } from "@/lib/studio/admin"

const BUCKET = "devdashboard-c9159-ca"
const PROJECT_ID = "devdashboard-c9159"

// Local QA: the same Storage emulator the browser uploads to (see
// docs/studio-capture/README.md).
function storageBase(): string {
  const host =
    process.env.NODE_ENV !== "production"
      ? (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST)
      : undefined
  return host ? `http://${host}:9199` : "https://firebasestorage.googleapis.com"
}

export class StorageError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Storage responded ${status}: ${detail.slice(0, 300)}`)
  }
}

// Reads go through the Firebase Storage API with the admin's own ID token, so
// the storage rules decide what they can see and no service account is needed.
async function storageGet(token: string, path: string): Promise<Response> {
  const response = await fetch(`${storageBase()}/v0/b/${BUCKET}/o${path}`, {
    headers: { Authorization: `Firebase ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new StorageError(response.status, await response.text())
  return response
}

type Listing = { prefixes: string[]; items: string[] }

// One folder level, the way the Firebase SDK lists: prefix plus "/" delimiter.
async function list(token: string, prefix: string): Promise<Listing> {
  const listing: Listing = { prefixes: [], items: [] }
  let pageToken: string | undefined
  do {
    const query = new URLSearchParams({ prefix, delimiter: "/", maxResults: "1000" })
    if (pageToken) query.set("pageToken", pageToken)
    const body = (await (await storageGet(token, `?${query}`)).json()) as {
      prefixes?: string[]
      items?: { name: string }[]
      nextPageToken?: string
    }
    listing.prefixes.push(...(body.prefixes ?? []))
    listing.items.push(...(body.items ?? []).map((item) => item.name))
    pageToken = body.nextPageToken
  } while (pageToken)
  return listing
}

type ObjectMeta = {
  size?: string
  contentType?: string
  timeCreated?: string
  downloadTokens?: string
  metadata?: Record<string, string>
}

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

function consoleUrl(folder: string): string {
  return `https://console.firebase.google.com/project/${PROJECT_ID}/storage/${BUCKET}/files/~2F${folder.split("/").join("~2F")}`
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
  const recording = items.find((name) => /\/recording\.\w+$/.test(name))
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
        url: `${storageBase()}/v0/b/${BUCKET}/o/${encode(recording)}?alt=media&token=${downloadToken}`,
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

// Every studio/{uid}/{submissionId}/ folder, newest first.
export async function loadSubmissions(token: string): Promise<Submission[]> {
  const people = await list(token, "studio/")
  const folders = (await inBatches(people.prefixes, 10, (prefix) => list(token, prefix))).flatMap((l) => l.prefixes)
  const submissions = await inBatches(folders, 10, async (prefix) => {
    const folder = prefix.replace(/\/$/, "")
    return readSubmission(token, folder, (await list(token, prefix)).items)
  })
  const at = (s: Submission) => s.requestedAt ?? s.recordedAt ?? ""
  return submissions.sort((a, b) => at(b).localeCompare(at(a)))
}
