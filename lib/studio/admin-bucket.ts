import { Readable } from "node:stream"

import { StorageError, type Listing, type ObjectMeta, type StudioBucket } from "@/lib/studio/storage"

// The slice of @google-cloud/storage's Bucket (what firebase-admin's
// getStorage().bucket() returns) that the admin routes use, so the adapter
// can be tested without a bucket.
type GcsMetadata = {
  name?: string
  size?: string | number
  contentType?: string
  timeCreated?: string
  metadata?: Record<string, unknown>
}
type GcsFile = {
  getMetadata: () => Promise<[GcsMetadata, unknown]>
  download: () => Promise<[Buffer]>
  createReadStream: () => Readable
  delete: () => Promise<unknown>
}
export type GcsBucket = {
  getFiles: (query: {
    prefix: string
    delimiter: string
    autoPaginate: false
    maxResults: number
    pageToken?: string
  }) => Promise<[{ name: string }[], { pageToken?: string } | null | object, unknown]>
  file: (name: string) => GcsFile
}

// The Storage API throws an Error whose `code` is the HTTP status; that
// becomes a StorageError so the routes can tell a 404 from a refusal.
// Anything else (a dropped socket) passes through as it is.
async function call<T>(what: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code
    if (typeof code === "number") throw new StorageError(code, `${what}: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export function gcsBucket(bucket: GcsBucket): StudioBucket {
  const meta = async (objectName: string): Promise<ObjectMeta> => {
    const [m] = await call(`metadata of ${objectName}`, () => bucket.file(objectName).getMetadata())
    // Firebase keeps download tokens among the custom metadata; the rest is
    // what the uploader's browser set, kept only where it is a string.
    const { firebaseStorageDownloadTokens: tokens, ...custom } = m.metadata ?? {}
    const strings = Object.entries(custom).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    return {
      name: m.name ?? objectName,
      size: m.size === undefined ? undefined : String(m.size),
      contentType: m.contentType,
      timeCreated: m.timeCreated,
      downloadTokens: typeof tokens === "string" ? tokens : undefined,
      metadata: Object.fromEntries(strings),
    }
  }

  return {
    // One folder level, following the page token so a long folder isn't cut
    // off at 1000 objects.
    async list(prefix) {
      const listing: Listing = { prefixes: [], items: [] }
      let pageToken: string | undefined
      do {
        const [files, next, response] = await call(`list ${prefix}`, () =>
          bucket.getFiles({ prefix, delimiter: "/", autoPaginate: false, maxResults: 1000, pageToken }),
        )
        listing.items.push(...files.map((file) => file.name))
        const prefixes = (response as { prefixes?: unknown } | null)?.prefixes
        if (Array.isArray(prefixes)) listing.prefixes.push(...prefixes.filter((p): p is string => typeof p === "string"))
        pageToken = (next as { pageToken?: string } | null)?.pageToken
      } while (pageToken)
      return listing
    },
    meta,
    async json(objectName) {
      const [body] = await call(`read ${objectName}`, () => bucket.file(objectName).download())
      return JSON.parse(body.toString("utf8")) as unknown
    },
    // The metadata read first answers a missing or refused object before any
    // bytes are promised.
    async read(objectName) {
      const { contentType, size } = await meta(objectName)
      const length = Number(size)
      const body = Readable.toWeb(bucket.file(objectName).createReadStream()) as ReadableStream<Uint8Array>
      return { body, contentType, length: Number.isFinite(length) && size !== undefined ? length : undefined }
    },
    async remove(objectName) {
      await call(`delete ${objectName}`, () => bucket.file(objectName).delete())
    },
  }
}
