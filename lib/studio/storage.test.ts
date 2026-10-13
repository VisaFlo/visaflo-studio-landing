import { describe, expect, it } from "vitest"

import { firstDownloadToken, mediaUrl, storageBase, StorageError } from "@/lib/studio/storage"

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

describe("StorageError", () => {
  it("knows refused credentials from any other failure, and keeps its message short", () => {
    expect(new StorageError(401, "x").refused).toBe(true)
    expect(new StorageError(403, "x").refused).toBe(true)
    expect(new StorageError(404, "x").refused).toBe(false)
    expect(new StorageError(500, "x").refused).toBe(false)
    expect(new StorageError(500, "x".repeat(400)).message.length).toBeLessThan(330)
  })
})
