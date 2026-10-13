import { afterEach, describe, expect, it, vi } from "vitest"

import { StorageError } from "@/lib/studio/storage"
import { describeProblems, downloadName, loadSubmission, loadSubmissions, parseSubmissionId, readRequestJson } from "@/lib/studio/submissions"
import { fakeBucket, type Bucket } from "@/lib/studio/test-bucket"

describe("parseSubmissionId", () => {
  it("accepts uid/submissionId", () => {
    expect(parseSubmissionId("abcDEF123/20261009T120000-1a2b3c4d")).toEqual({ uid: "abcDEF123", submissionId: "20261009T120000-1a2b3c4d" })
  })
  it("rejects anything that could escape the folder", () => {
    for (const bad of ["", "a", "a/b/c", "../x/y", "a/..", "a b/c", 42, null, "a/b%2F"]) {
      expect(parseSubmissionId(bad)).toBeNull()
    }
  })
})

describe("downloadName", () => {
  it("names the file after the person and the submission, with the recording's extension", () => {
    expect(downloadName({ name: "Dan Jeong", uid: "u", submissionId: "20261009T211755-393dbaa7" }, "studio/u/s/recording.mp4")).toBe(
      "dan-jeong-20261009T211755-393dbaa7.mp4",
    )
  })
  it("falls back to the email, then the uid, and strips anything odd", () => {
    expect(downloadName({ email: "a.b@firm.ca", uid: "U1", submissionId: "S1" }, "studio/U1/S1/recording.webm")).toBe("a-b-firm-ca-S1.webm")
    expect(downloadName({ uid: "Mi0wDogz", submissionId: "S1" }, "x/recording.mp4")).toBe("Mi0wDogz-S1.mp4")
    expect(downloadName({ name: "  ", uid: "u", submissionId: "s" }, "x/recording")).toBe("u-s.mp4")
  })
  it("falls through when a name has no Latin letters at all", () => {
    expect(downloadName({ name: "김철수", email: "kim@firm.ca", uid: "U1", submissionId: "S1" }, "x/recording.mp4")).toBe("kim-firm-ca-S1.mp4")
    expect(downloadName({ name: "###", uid: "U1", submissionId: "S1" }, "x/recording.mp4")).toBe("U1-S1.mp4")
  })
  it("never lets a quote or slash into the header", () => {
    expect(downloadName({ name: 'Dan"; x=y', uid: "U1", submissionId: "S1" }, "x/recording.mp4")).toBe("dan-x-y-S1.mp4")
  })
})

describe("readRequestJson", () => {
  it("keeps only the fields the admin shows, as the right types", () => {
    const raw = {
      email: "a@b.c",
      name: "Dan",
      firm: 42,
      topicTitle: " Express Entry ",
      recordingSeconds: "61",
      checks: { faceSeen: true, voiceHeard: null },
      consent: { nope: true },
      consentAt: "2026-10-09T21:17:55.000Z",
      createdAt: ["x"],
      extra: "ignored",
    }
    expect(readRequestJson(raw)).toEqual({
      email: "a@b.c",
      name: "Dan",
      topicTitle: "Express Entry",
      recordingSeconds: 61,
      checks: { faceSeen: true, voiceHeard: null },
      consentAt: "2026-10-09T21:17:55.000Z",
    })
  })
  it("caps long text and survives a non-object", () => {
    expect(readRequestJson({ name: "x".repeat(300) }).name).toHaveLength(200)
    expect(readRequestJson({ consent: "y".repeat(2001) }).consent).toHaveLength(2000)
    expect(readRequestJson(null)).toEqual({})
    expect(readRequestJson("str")).toEqual({})
  })
})

describe("describeProblems", () => {
  it("writes one line the admin can act on", () => {
    expect(describeProblems([{ kind: "no-recording" }, { kind: "request-unreadable", detail: "Storage responded 500: x" }])).toBe(
      "No recording file in this folder; request.json couldn't be read (Storage responded 500: x)",
    )
    expect(describeProblems([])).toBe("")
  })
})

const META = {
  name: "studio/u1/s1/recording.mp4",
  size: "1234",
  contentType: "video/mp4",
  timeCreated: "2026-10-09T21:17:55.000Z",
  downloadTokens: "tok1,tok2",
  metadata: { email: "meta@x", seconds: "61" },
}
const REQUEST = {
  email: "req@x",
  name: "Dan Jeong",
  firm: "Firm",
  topicTitle: "Family",
  recordingSeconds: 62,
  createdAt: "2026-10-09T21:20:00.000Z",
  checks: { faceSeen: true, voiceHeard: true },
  consent: "I agree",
  consentAt: "2026-10-09T21:19:00.000Z",
}

describe("loadSubmission", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("assembles a full folder, request.json winning over the recording's metadata", async () => {
    fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      meta: { "studio/u1/s1/recording.mp4": META },
      media: { "studio/u1/s1/request.json": REQUEST },
    })
    const s = await loadSubmission("t", { uid: "u1", submissionId: "s1" })
    expect(s).toMatchObject({
      id: "u1/s1",
      status: "requested",
      email: "req@x",
      name: "Dan Jeong",
      seconds: 62,
      recordedAt: META.timeCreated,
      requestedAt: REQUEST.createdAt,
      consent: "I agree",
      problems: [],
    })
    expect(s?.video?.url.endsWith("/o/studio%2Fu1%2Fs1%2Frecording.mp4?alt=media&token=tok1")).toBe(true)
    expect(s?.video).toMatchObject({ contentType: "video/mp4", bytes: 1234 })
  })

  it("reads a recording-only folder from the object metadata", async () => {
    fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.webm"] } }, meta: { "studio/u1/s1/recording.webm": META } })
    const s = await loadSubmission("t", { uid: "u1", submissionId: "s1" })
    expect(s).toMatchObject({ status: "recorded", email: "meta@x", seconds: 61, problems: [] })
    expect(s?.requestedAt).toBeUndefined()
  })

  it("is null for a folder with nothing in it", async () => {
    fakeBucket({ listings: {} })
    expect(await loadSubmission("t", { uid: "u1", submissionId: "nope" })).toBeNull()
  })

  it("keeps the request when the recording is missing, and says so", async () => {
    fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/request.json"] } }, media: { "studio/u1/s1/request.json": REQUEST } })
    const s = await loadSubmission("t", { uid: "u1", submissionId: "s1" })
    expect(s).toMatchObject({ status: "requested", name: "Dan Jeong", problems: [{ kind: "no-recording" }] })
    expect(s?.video).toBeUndefined()
  })

  it("has no video without a download token but still knows when it was recorded", async () => {
    fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } },
      meta: { "studio/u1/s1/recording.mp4": { ...META, downloadTokens: undefined } },
    })
    const s = await loadSubmission("t", { uid: "u1", submissionId: "s1" })
    expect(s?.video).toBeUndefined()
    expect(s?.recordedAt).toBe(META.timeCreated)
    expect(s?.problems).toEqual([{ kind: "no-token" }])
  })

  it("reports an unreadable recording or request without losing the other half", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      meta: { "studio/u1/s1/recording.mp4": 500 },
      media: { "studio/u1/s1/request.json": "not json" },
    })
    const s = await loadSubmission("t", { uid: "u1", submissionId: "s1" })
    expect(s?.problems.map((p) => p.kind).sort()).toEqual(["meta-unreadable", "request-unreadable"])
    expect(s?.problems.find((p) => p.kind === "meta-unreadable")?.detail).toContain("500")
    expect(s?.status).toBe("recorded")
    expect(quiet).toHaveBeenCalledTimes(2)
    quiet.mockRestore()
  })

  it("lets a refused read (rules not published) reach the route instead of hiding it per file", async () => {
    fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } }, meta: { "studio/u1/s1/recording.mp4": 403 } })
    await expect(loadSubmission("t", { uid: "u1", submissionId: "s1" })).rejects.toBeInstanceOf(StorageError)
  })
})

describe("loadSubmissions", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("walks every uid and submission, newest first by request then recording time", async () => {
    const bucket: Bucket = {
      listings: {
        "studio/": { prefixes: ["studio/u1/", "studio/u2/"] },
        "studio/u1/": { prefixes: ["studio/u1/old/", "studio/u1/new/"] },
        "studio/u2/": { prefixes: ["studio/u2/mid/"] },
        "studio/u1/old/": { items: ["studio/u1/old/recording.mp4"] },
        "studio/u1/new/": { items: ["studio/u1/new/recording.mp4", "studio/u1/new/request.json"] },
        "studio/u2/mid/": { items: ["studio/u2/mid/recording.mp4"] },
      },
      meta: {
        "studio/u1/old/recording.mp4": { ...META, timeCreated: "2026-10-01T00:00:00.000Z" },
        "studio/u1/new/recording.mp4": { ...META, timeCreated: "2026-10-02T00:00:00.000Z" },
        "studio/u2/mid/recording.mp4": { ...META, timeCreated: "2026-10-05T00:00:00.000Z" },
      },
      media: { "studio/u1/new/request.json": { ...REQUEST, createdAt: "2026-10-09T00:00:00.000Z" } },
    }
    fakeBucket(bucket)
    expect((await loadSubmissions("t")).map((s) => s.id)).toEqual(["u1/new", "u2/mid", "u1/old"])
  })

  it("is empty when nobody has recorded", async () => {
    fakeBucket({ listings: { "studio/": {} } })
    expect(await loadSubmissions("t")).toEqual([])
  })
})
