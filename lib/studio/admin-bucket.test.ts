import { Readable } from "node:stream"

import { describe, expect, it, vi } from "vitest"

import { gcsBucket, type GcsBucket } from "@/lib/studio/admin-bucket"
import { StorageError } from "@/lib/studio/storage"

// The shape @google-cloud/storage throws: an Error with the HTTP status as a number `code`.
const apiError = (code: number) => Object.assign(new Error(`api said ${code}`), { code })

function fakeGcs(files: Record<string, { metadata?: Record<string, unknown>; body?: string; fails?: number }>, pages: GcsBucket["getFiles"] = vi.fn()) {
  const file = vi.fn((name: string) => {
    const entry = files[name]
    const fail = () => Promise.reject(apiError(entry?.fails ?? 404))
    const ok = entry && !entry.fails
    return {
      getMetadata: vi.fn(() => (ok ? Promise.resolve([{ name, ...entry.metadata }, {}]) : fail())),
      download: vi.fn(() => (ok ? Promise.resolve([Buffer.from(entry.body ?? "")]) : fail())),
      createReadStream: vi.fn(() => Readable.from([Buffer.from(entry?.body ?? "")])),
      delete: vi.fn(() => (ok ? Promise.resolve([{}]) : fail())),
    }
  })
  return { getFiles: pages, file } as unknown as GcsBucket & { file: typeof file; getFiles: ReturnType<typeof vi.fn> }
}

describe("gcsBucket", () => {
  it("lists one folder level, following the page token", async () => {
    const getFiles = vi
      .fn()
      .mockResolvedValueOnce([[{ name: "studio/a.json" }], { pageToken: "p2" }, { prefixes: ["studio/u1/"] }])
      .mockResolvedValueOnce([[], null, { prefixes: ["studio/u2/"] }])
    const bucket = gcsBucket(fakeGcs({}, getFiles))
    expect(await bucket.list("studio/")).toEqual({ prefixes: ["studio/u1/", "studio/u2/"], items: ["studio/a.json"] })
    expect(getFiles).toHaveBeenNthCalledWith(1, expect.objectContaining({ prefix: "studio/", delimiter: "/", autoPaginate: false }))
    expect(getFiles).toHaveBeenNthCalledWith(2, expect.objectContaining({ pageToken: "p2" }))
  })

  it("lists an empty folder when the response has no prefixes", async () => {
    const bucket = gcsBucket(fakeGcs({}, vi.fn().mockResolvedValue([[], null, {}])))
    expect(await bucket.list("studio/x/")).toEqual({ prefixes: [], items: [] })
  })

  it("reads metadata in the ObjectMeta shape: download tokens apart, only string custom fields", async () => {
    const bucket = gcsBucket(
      fakeGcs({
        "studio/u1/s1/recording.mp4": {
          metadata: {
            size: 1234,
            contentType: "video/mp4",
            timeCreated: "2026-10-09T00:00:00.000Z",
            metadata: { firebaseStorageDownloadTokens: "tok1,tok2", email: "a@b.c", seconds: "61", odd: 5 },
          },
        },
      }),
    )
    expect(await bucket.meta("studio/u1/s1/recording.mp4")).toEqual({
      name: "studio/u1/s1/recording.mp4",
      size: "1234",
      contentType: "video/mp4",
      timeCreated: "2026-10-09T00:00:00.000Z",
      downloadTokens: "tok1,tok2",
      metadata: { email: "a@b.c", seconds: "61" },
    })
  })

  it("parses JSON, and lets a body that isn't JSON throw", async () => {
    const bucket = gcsBucket(fakeGcs({ "a.json": { body: '{"name":"Dan"}' }, "b.json": { body: "<html>" } }))
    expect(await bucket.json("a.json")).toEqual({ name: "Dan" })
    await expect(bucket.json("b.json")).rejects.toBeInstanceOf(SyntaxError)
  })

  it("streams an object with its type and length", async () => {
    const bucket = gcsBucket(fakeGcs({ "r.mp4": { body: "hello", metadata: { contentType: "video/mp4", size: "5" } } }))
    const { body, contentType, length } = await bucket.read("r.mp4")
    expect(contentType).toBe("video/mp4")
    expect(length).toBe(5)
    expect(await new Response(body).text()).toBe("hello")
  })

  it("deletes the one object", async () => {
    const gcs = fakeGcs({ "r.mp4": {} })
    await gcsBucket(gcs).remove("r.mp4")
    expect(gcs.file).toHaveBeenCalledWith("r.mp4")
    expect(gcs.file.mock.results[0].value.delete).toHaveBeenCalled()
  })

  it("turns an API error into a StorageError that keeps the status, and leaves other errors alone", async () => {
    const bucket = gcsBucket(fakeGcs({ "gone.mp4": { fails: 404 }, "no.mp4": { fails: 403 } }, vi.fn().mockRejectedValue(new TypeError("socket"))))
    await expect(bucket.meta("gone.mp4")).rejects.toMatchObject({ name: "StorageError", status: 404 })
    await expect(bucket.remove("no.mp4")).rejects.toMatchObject({ name: "StorageError", status: 403 })
    await expect(bucket.read("no.mp4")).rejects.toBeInstanceOf(StorageError)
    await expect(bucket.list("studio/")).rejects.toBeInstanceOf(TypeError)
  })
})
