import { vi } from "vitest"

import { StorageError, type ObjectMeta, type StudioBucket } from "@/lib/studio/storage"

// An in-memory StudioBucket for tests, so the real submissions and route code
// runs against these objects. A number in place of a value throws a
// StorageError with that status. Like the real bucket, an unknown prefix
// lists as empty while an unknown object is a 404.
export type Bucket = {
  /** Keyed by the prefix listed ("studio/", "studio/u1/s1/"). */
  listings: Record<string, { prefixes?: string[]; items?: string[] } | number>
  /** Object metadata by object name. */
  meta?: Record<string, ObjectMeta | number>
  /** Object contents by object name: JSON, raw text, or a status. `read` serves raw text as text/plain. */
  media?: Record<string, unknown>
  /** What deleting an object does, by object name: a status to fail with. Unlisted names delete fine. */
  deletes?: Record<string, number>
  /** What creating an object does, by object name: a status to fail with. Unlisted names are created fine. */
  creates?: Record<string, number>
}

const refuse = (status: number, what: string) => new StorageError(status, `status ${status} for ${what}`)

export function fakeBucket(bucket: Bucket) {
  const media = (name: string) => {
    const value = bucket.media?.[name]
    if (value === undefined) throw refuse(404, name)
    if (typeof value === "number") throw refuse(value, name)
    return value
  }
  const fake = {
    list: vi.fn<StudioBucket["list"]>(async (prefix) => {
      const listing = bucket.listings[prefix]
      if (listing === undefined) return { prefixes: [], items: [] }
      if (typeof listing === "number") throw refuse(listing, prefix)
      return { prefixes: listing.prefixes ?? [], items: listing.items ?? [] }
    }),
    meta: vi.fn<StudioBucket["meta"]>(async (name) => {
      const meta = bucket.meta?.[name]
      if (meta === undefined) throw refuse(404, name)
      if (typeof meta === "number") throw refuse(meta, name)
      return meta
    }),
    json: vi.fn<StudioBucket["json"]>(async (name) => {
      const value = media(name)
      return typeof value === "string" ? JSON.parse(value) : value
    }),
    read: vi.fn<StudioBucket["read"]>(async (name) => {
      const value = media(name)
      const text = typeof value === "string" ? value : JSON.stringify(value)
      return { body: new Response(text).body!, contentType: typeof value === "string" ? "text/plain" : "application/json" }
    }),
    remove: vi.fn<StudioBucket["remove"]>(async (name) => {
      const status = bucket.deletes?.[name]
      if (status !== undefined) throw refuse(status, name)
    }),
    create: vi.fn<StudioBucket["create"]>(async (name) => {
      const status = bucket.creates?.[name]
      if (status !== undefined) throw refuse(status, name)
    }),
  } satisfies StudioBucket
  return fake
}
