import { afterEach, describe, expect, it, vi } from "vitest"

import { firstDownloadToken, listObjects, mediaUrl, storageBase, StorageError } from "@/lib/studio/storage"
import { fakeBucket } from "@/lib/studio/test-bucket"

describe("mediaUrl", () => {
  it("encodes the object name and carries the token", () => {
    expect(mediaUrl("studio/u1/s1/recording.mp4", "abc")).toBe(
      `${storageBase()}/v0/b/devdashboard-c9159-ca/o/studio%2Fu1%2Fs1%2Frecording.mp4?alt=media&token=abc`,
    )
  })
})

describe("firstDownloadToken", () => {
  it("takes the first of the comma-joined tokens, or nothing", () => {
    expect(firstDownloadToken({ name: "x", downloadTokens: "a,b" })).toBe("a")
    expect(firstDownloadToken({ name: "x" })).toBeUndefined()
    expect(firstDownloadToken({ name: "x", downloadTokens: "" })).toBeUndefined()
  })
})

describe("listObjects", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("follows nextPageToken so a long folder isn't cut off at one page", async () => {
    const fetch = fakeBucket({
      listings: {
        "studio/": { prefixes: ["studio/u1/"], nextPageToken: "p2" },
        "studio/#p2": { prefixes: ["studio/u2/"], items: ["studio/x.json"] },
      },
    })
    expect(await listObjects("t", "studio/")).toEqual({ prefixes: ["studio/u1/", "studio/u2/"], items: ["studio/x.json"] })
    const second = new URL(String(fetch.mock.calls[1][0]))
    expect(second.searchParams.get("pageToken")).toBe("p2")
    expect(second.searchParams.get("delimiter")).toBe("/")
  })

  it("throws a StorageError that keeps the status", async () => {
    fakeBucket({ listings: { "studio/": 403 } })
    await expect(listObjects("t", "studio/")).rejects.toMatchObject({ name: "StorageError", status: 403 })
    expect(new StorageError(500, "x".repeat(400)).message.length).toBeLessThan(330)
  })
})
