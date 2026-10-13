// Firebase Storage over REST with the caller's own ID token: the storage
// rules decide what each token may read, so no service account is needed on
// Vercel.
import { BUCKET, PROJECT_ID } from "@/lib/studio/project"

// Local QA: the same Storage emulator the browser uploads to (see
// docs/studio-capture/README.md).
export function storageBase(): string {
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
    this.name = "StorageError"
  }

  /** The token or the rules said no: about the caller, not about this one object. */
  get refused(): boolean {
    return this.status === 401 || this.status === 403
  }
}

export type ObjectMeta = {
  name: string
  size?: string
  contentType?: string
  timeCreated?: string
  /** Comma-joined; any one of them opens the file through mediaUrl. */
  downloadTokens?: string
  /** Custom metadata the uploader's browser set (lib/studio/upload.ts): read it as carefully as request.json. */
  metadata?: Record<string, string>
}

const objects = () => `${storageBase()}/v0/b/${BUCKET}/o`

export async function storageGet(token: string, path: string): Promise<Response> {
  const response = await fetch(`${objects()}${path}`, {
    headers: { Authorization: `Firebase ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new StorageError(response.status, await response.text())
  return response
}

export async function storageJson<T>(token: string, objectName: string): Promise<T> {
  return (await storageGet(token, `/${encodeURIComponent(objectName)}?alt=media`)).json() as Promise<T>
}

export async function storageMeta(token: string, objectName: string): Promise<ObjectMeta> {
  return (await storageGet(token, `/${encodeURIComponent(objectName)}`)).json() as Promise<ObjectMeta>
}

export function firstDownloadToken(meta: ObjectMeta): string | undefined {
  return meta.downloadTokens?.split(",")[0] || undefined
}

export type Listing = { prefixes: string[]; items: string[] }

// One folder level, the way the Firebase SDK lists: prefix plus "/" delimiter,
// following the page token so a long folder isn't cut off at 1000 objects.
export async function listObjects(token: string, prefix: string): Promise<Listing> {
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

// A link that opens the file for anyone holding the token, no header needed:
// what the admin page's <video> plays and "Open recording" opens. It works
// until the token is revoked in the Firebase console.
export function mediaUrl(objectName: string, downloadToken: string): string {
  return `${objects()}/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`
}

// The Firebase console writes "/" in a files path as "~2F".
export function consoleUrl(folder: string): string {
  return `https://console.firebase.google.com/project/${PROJECT_ID}/storage/${BUCKET}/files/~2F${folder.split("/").join("~2F")}`
}
