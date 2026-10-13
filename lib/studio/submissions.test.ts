import { afterEach, describe, expect, it, vi } from "vitest"

import { StorageError } from "@/lib/studio/storage"
import { downloadName, loadSubmission, loadSubmissions, parseSubmissionId, recordingObject } from "@/lib/studio/submissions"
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

describe("recordingObject", () => {
  it("finds the recording in a folder listing, in any container the rules allow", () => {
    expect(recordingObject(["studio/u/s/request.json", "studio/u/s/recording.webm"])).toBe("studio/u/s/recording.webm")
    expect(recordingObject(["studio/u/s/recording.m4v"])).toBe("studio/u/s/recording.m4v")
    expect(recordingObject(["studio/u/s/recording.txt", "studio/u/s/request.json"])).toBeUndefined()
  })
})

const REF = { uid: "U1", submissionId: "S1" }

describe("downloadName", () => {
  it("names the file after the person and the submission, with the recording's extension", () => {
    expect(downloadName({ name: "Dan Jeong" }, { uid: "u", submissionId: "20261009T211755-393dbaa7" }, "studio/u/s/recording.mp4")).toBe(
      "dan-jeong-20261009T211755-393dbaa7.mp4",
    )
  })
  it("falls back to the email, then the uid, and strips anything odd", () => {
    expect(downloadName({ email: "a.b@firm.ca" }, REF, "studio/U1/S1/recording.webm")).toBe("a-b-firm-ca-S1.webm")
    expect(downloadName({}, { uid: "Mi0wDogz", submissionId: "S1" }, "x/recording.mp4")).toBe("Mi0wDogz-S1.mp4")
    expect(downloadName({ name: "  " }, { uid: "u", submissionId: "s" }, "x/recording")).toBe("u-s.mp4")
  })
  it("falls through when a name has no Latin letters at all", () => {
    expect(downloadName({ name: "김철수", email: "kim@firm.ca" }, REF, "x/recording.mp4")).toBe("kim-firm-ca-S1.mp4")
    expect(downloadName({ name: "###" }, REF, "x/recording.mp4")).toBe("U1-S1.mp4")
  })
  it("never lets a quote or slash into the header", () => {
    expect(downloadName({ name: 'Dan"; x=y' }, REF, "x/recording.mp4")).toBe("dan-x-y-S1.mp4")
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
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("assembles a full folder, request.json winning over the recording's metadata", async () => {
    const bucket = fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      meta: { "studio/u1/s1/recording.mp4": META },
      media: { "studio/u1/s1/request.json": REQUEST },
    })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
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
    expect(s?.recording?.url?.endsWith("/o/studio%2Fu1%2Fs1%2Frecording.mp4?alt=media&token=tok1")).toBe(true)
    expect(s?.recording).toMatchObject({ name: "studio/u1/s1/recording.mp4", contentType: "video/mp4", bytes: 1234 })
  })

  it("falls back to the recording's metadata for what request.json leaves out", async () => {
    const partial = Object.fromEntries(Object.entries(REQUEST).filter(([key]) => key !== "email" && key !== "recordingSeconds"))
    const bucket = fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      meta: { "studio/u1/s1/recording.mp4": META },
      media: { "studio/u1/s1/request.json": partial },
    })
    expect(await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })).toMatchObject({ status: "requested", email: "meta@x", seconds: 61 })
  })

  it("reads a recording-only folder from the object metadata", async () => {
    const bucket = fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.webm"] } }, meta: { "studio/u1/s1/recording.webm": META } })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
    expect(s).toMatchObject({ status: "recorded", email: "meta@x", seconds: 61, problems: [] })
    expect(s?.requestedAt).toBeUndefined()
  })

  it("reads the uploader's own metadata as carefully as request.json", async () => {
    const bucket = fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.webm"] } },
      meta: { "studio/u1/s1/recording.webm": { ...META, size: "big", metadata: { email: "x@y.com?bcc=evil@z.com", seconds: "lots" } } },
    })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
    expect(s?.email).toBeUndefined()
    expect(s?.seconds).toBeUndefined()
    expect(s?.recording?.bytes).toBeUndefined()
  })

  it("is null for a folder with nothing in it", async () => {
    const bucket = fakeBucket({ listings: {} })
    expect(await loadSubmission(bucket, { uid: "u1", submissionId: "nope" })).toBeNull()
  })

  it("keeps the request when the recording is missing, and says so", async () => {
    const bucket = fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/request.json"] } }, media: { "studio/u1/s1/request.json": REQUEST } })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
    expect(s).toMatchObject({ status: "requested", name: "Dan Jeong", problems: [{ kind: "no-recording" }] })
    expect(s?.recording).toBeUndefined()
  })

  it("has no player without a download token but still offers the file and knows when it was recorded", async () => {
    const bucket = fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } },
      meta: { "studio/u1/s1/recording.mp4": { ...META, downloadTokens: undefined } },
    })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
    expect(s?.recording).toEqual({ name: "studio/u1/s1/recording.mp4", contentType: "video/mp4", bytes: 1234 })
    expect(s?.recordedAt).toBe(META.timeCreated)
    expect(s?.problems).toEqual([{ kind: "no-token" }])
  })

  it("reports an unreadable recording or request without losing the other half", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    const bucket = fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      meta: { "studio/u1/s1/recording.mp4": 500 },
      media: { "studio/u1/s1/request.json": "not json" },
    })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
    expect(s?.problems.map((p) => p.kind).sort()).toEqual(["meta-unreadable", "request-unreadable"])
    expect(s?.problems.find((p) => p.kind === "meta-unreadable")?.detail).toContain("500")
    expect(s?.status).toBe("request-unreadable")
    expect(s?.recording).toEqual({ name: "studio/u1/s1/recording.mp4" })
    expect(quiet).toHaveBeenCalledWith(expect.stringContaining("request.json in studio/u1/s1"), expect.anything())
  })

  it("says what a request.json that isn't an object was, rather than blaming a missing topic", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const bucket = fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      meta: { "studio/u1/s1/recording.mp4": META },
      media: { "studio/u1/s1/request.json": ["x"] },
    })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
    expect(s?.status).toBe("request-unreadable")
    expect(s?.problems).toEqual([{ kind: "request-unreadable", detail: "request.json is an array, not an object" }])
  })

  it("doesn't call a request.json without a topic a picked topic", async () => {
    const bucket = fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      meta: { "studio/u1/s1/recording.mp4": META },
      media: { "studio/u1/s1/request.json": { name: "Dan" } },
    })
    const s = await loadSubmission(bucket, { uid: "u1", submissionId: "s1" })
    expect(s?.status).toBe("request-unreadable")
    expect(s?.name).toBe("Dan")
    expect(s?.problems).toEqual([{ kind: "request-unreadable", detail: "no topicTitle" }])
  })

  it("lets a refused read (the service account's credentials or IAM) reach the route instead of hiding it per file", async () => {
    const refused = fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } }, meta: { "studio/u1/s1/recording.mp4": 403 } })
    await expect(loadSubmission(refused, { uid: "u1", submissionId: "s1" })).rejects.toBeInstanceOf(StorageError)
    const bucket = fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } }, meta: { "studio/u1/s1/recording.mp4": 401 } })
    await expect(loadSubmission(bucket, { uid: "u1", submissionId: "s1" })).rejects.toMatchObject({ status: 401 })
  })
})

describe("loadSubmissions", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("walks every uid and submission, newest first by request then recording time", async () => {
    const objects: Bucket = {
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
    expect((await loadSubmissions(fakeBucket(objects))).map((s) => s.id)).toEqual(["u1/new", "u2/mid", "u1/old"])
  })

  it("skips a folder that isn't uid/submissionId and keeps the rest", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    const bucket = fakeBucket({
      listings: {
        "studio/": { prefixes: ["studio/u1/"] },
        "studio/u1/": { prefixes: ["studio/u1/ok/", "studio/u1/has space/"] },
        "studio/u1/ok/": { items: ["studio/u1/ok/recording.mp4"] },
      },
      meta: { "studio/u1/ok/recording.mp4": META },
    })
    expect((await loadSubmissions(bucket)).map((s) => s.id)).toEqual(["u1/ok"])
    expect(quiet).toHaveBeenCalledWith(expect.stringContaining("studio/u1/has space/"))
  })

  it("reads every folder when both the people and their submissions run past one batch", async () => {
    // 12 people × 2 submissions: more than one batch at each level.
    const uids = Array.from({ length: 12 }, (_, i) => `u${String(i).padStart(2, "0")}`)
    const objects: Bucket = { listings: { "studio/": { prefixes: uids.map((uid) => `studio/${uid}/`) } }, meta: {} }
    const expected: string[] = []
    for (const uid of uids) {
      objects.listings[`studio/${uid}/`] = { prefixes: [`studio/${uid}/a/`, `studio/${uid}/b/`] }
      for (const id of ["a", "b"]) {
        objects.listings[`studio/${uid}/${id}/`] = { items: [`studio/${uid}/${id}/recording.mp4`] }
        objects.meta![`studio/${uid}/${id}/recording.mp4`] = META
        expected.push(`${uid}/${id}`)
      }
    }
    const loaded = await loadSubmissions(fakeBucket(objects))
    expect(loaded.map((s) => s.id).sort()).toEqual(expected)
  })

  it("is empty when nobody has recorded", async () => {
    const bucket = fakeBucket({ listings: { "studio/": {} } })
    expect(await loadSubmissions(bucket)).toEqual([])
  })
})
