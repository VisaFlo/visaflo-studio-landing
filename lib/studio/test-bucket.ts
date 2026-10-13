import { vi } from "vitest"

import type { ObjectMeta } from "@/lib/studio/storage"

// A fake Firebase Storage REST endpoint for tests: `fetch` is stubbed so the
// real listObjects / storageGet code runs against these objects. A number in
// place of a value answers with that HTTP status.
export type Bucket = {
  /** Keyed by the prefix listed ("studio/", "studio/u1/s1/"). */
  listings: Record<string, { prefixes?: string[]; items?: string[]; nextPageToken?: string } | number>
  /** Object metadata by object name. */
  meta?: Record<string, ObjectMeta | number>
  /** Object contents (?alt=media) by object name: JSON, raw text, or a status. */
  media?: Record<string, unknown>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const refuse = (status: number) => new Response(`status ${status}`, { status })

export function fakeBucket(bucket: Bucket): ReturnType<typeof vi.fn> {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
    const rest = url.pathname.replace(/^\/v0\/b\/[^/]+\/o/, "")
    if (rest === "") {
      const key = `${url.searchParams.get("prefix") ?? ""}${url.searchParams.get("pageToken") ? `#${url.searchParams.get("pageToken")}` : ""}`
      const listing = bucket.listings[key]
      if (listing === undefined) return json({})
      if (typeof listing === "number") return refuse(listing)
      return json({ prefixes: listing.prefixes, items: listing.items?.map((name) => ({ name })), nextPageToken: listing.nextPageToken })
    }
    const name = decodeURIComponent(rest.slice(1))
    if (url.searchParams.get("alt") === "media") {
      const media = bucket.media?.[name]
      if (media === undefined) return refuse(404)
      if (typeof media === "number") return refuse(media)
      if (typeof media === "string") return new Response(media, { status: 200, headers: { "content-type": "text/plain" } })
      return json(media)
    }
    const meta = bucket.meta?.[name]
    if (meta === undefined) return refuse(404)
    if (typeof meta === "number") return refuse(meta)
    return json(meta)
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}
