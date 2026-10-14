// The studio/ objects as the server sees them. It reads them (and writes
// request.json) with the service account (lib/studio/admin-bucket.ts); the
// storage rules let a browser do nothing but create a recording.
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

  /** Storage refused the credentials: about the caller, not about this one object. */
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

export function firstDownloadToken(meta: ObjectMeta): string | undefined {
  return meta.downloadTokens?.split(",")[0] || undefined
}

export type Listing = { prefixes: string[]; items: string[] }

/**
 * What the server routes need from the bucket. Every method throws a
 * StorageError carrying the HTTP status when Storage says no (404 for a
 * missing object).
 */
export type StudioBucket = {
  /** One folder level: the sub-folders and the objects directly under `prefix` (which ends in "/"). */
  list: (prefix: string) => Promise<Listing>
  meta: (objectName: string) => Promise<ObjectMeta>
  /** The object parsed as JSON; a body that isn't JSON throws a SyntaxError. */
  json: (objectName: string) => Promise<unknown>
  read: (objectName: string) => Promise<{ body: ReadableStream<Uint8Array>; contentType?: string; length?: number }>
  remove: (objectName: string) => Promise<void>
  /** Creates the object; a 412 StorageError when it already exists, so nothing is ever overwritten. */
  create: (objectName: string, body: string, contentType: string) => Promise<void>
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
