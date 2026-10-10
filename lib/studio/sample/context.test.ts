import { describe, expect, it } from "vitest"

import { parseOptions, parseSampleId, sampleFile, storageFailure } from "@/lib/studio/sample/context"
import { defaultStatus } from "@/lib/studio/sample/status"
import { StorageError } from "@/lib/studio/storage"

describe("parseSampleId", () => {
  it("accepts uid/submissionId", () => {
    expect(parseSampleId("abcDEF123/20261009T120000-1a2b3c4d")).toEqual({
      uid: "abcDEF123",
      submissionId: "20261009T120000-1a2b3c4d",
      folder: "studio/abcDEF123/20261009T120000-1a2b3c4d",
      sampleFolder: "studio/abcDEF123/20261009T120000-1a2b3c4d/sample",
    })
  })
  it("rejects anything that could escape the folder", () => {
    for (const bad of ["", "a", "a/b/c", "../x/y", "a/..", "a b/c", 42, null, "a/b%2F"]) {
      expect(parseSampleId(bad)).toBeNull()
    }
  })
  it("builds file paths", () => {
    expect(sampleFile(parseSampleId("u/s")!, "speech.mp3")).toBe("studio/u/s/sample/speech.mp3")
  })
})

describe("parseOptions", () => {
  it("keeps current values for anything invalid", () => {
    const current = defaultStatus().options
    expect(
      parseOptions({ method: "scene", background: "nope", layout: "full", mood: 3, lipsync: "cheap", faceFrame: 9, clipStart: "20" }, current),
    ).toEqual({
      ...current,
      method: "scene",
      layout: "full",
      clipStart: 20,
    })
    expect(parseOptions({ faceFrame: 4, clipStart: -5, lipsync: "standard" }, current)).toEqual({ ...current, faceFrame: 4, lipsync: "standard" })
  })
})

describe("storageFailure", () => {
  it("maps rule denials to the publish-rules message", async () => {
    const res = storageFailure(new StorageError(403, "denied"))!
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/storage\.rules/)
    expect(storageFailure(new StorageError(500, "x"))).toBeNull()
    expect(storageFailure(new Error("x"))).toBeNull()
  })
})
