import { afterEach, describe, expect, it, vi } from "vitest"

import { StorageError } from "@/lib/studio/storage"
import { downloadName, loadSubmission, loadSubmissions, parseSubmissionId, recordingObject } from "@/lib/studio/submissions"
import { fakeBucket, type Bucket } from "@/lib/studio/test-bucket"

describe("parseSubmissionId", () => {
  it("accepts an id newSubmissionId could make", () => {
    expect(parseSubmissionId("20261009T120000-1a2b3c4d")).toBe("20261009T120000-1a2b3c4d")
  })
  it("rejects anything else, so nothing can escape the folder", () => {
    for (const bad of ["", "a", "abcDEF123/20261009T120000-1a2b3c4d", "../x", "20261009T120000-1a2b3c4d/..", "20261009T120000-1A2B3C4D", 42, null]) {
      expect(parseSubmissionId(bad)).toBeNull()
    }
  })
})

describe("recordingObject", () => {
  it("finds the recording in a folder listing, in any container the rules allow", () => {
    expect(recordingObject(["studio/s/request.json", "studio/s/recording.webm"])).toBe("studio/s/recording.webm")
    expect(recordingObject(["studio/s/recording.m4v"])).toBe("studio/s/recording.m4v")
    expect(recordingObject(["studio/s/recording.txt", "studio/s/request.json"])).toBeUndefined()
  })
})

const SID = "20261009T211755-393dbaa7"

describe("downloadName", () => {
  it("names the file after the person and the submission, with the recording's extension", () => {
    expect(downloadName({ name: "Dan Jeong" }, SID, `studio/${SID}/recording.mp4`)).toBe(`dan-jeong-${SID}.mp4`)
  })
  it("falls back to the email, then to 'recording', and strips anything odd", () => {
    expect(downloadName({ email: "a.b@firm.ca" }, SID, "x/recording.webm")).toBe(`a-b-firm-ca-${SID}.webm`)
    expect(downloadName({}, SID, "x/recording.mp4")).toBe(`recording-${SID}.mp4`)
    expect(downloadName({ name: "  " }, SID, "x/recording")).toBe(`recording-${SID}.mp4`)
  })
  it("falls through when a name has no Latin letters at all", () => {
    expect(downloadName({ name: "김철수", email: "kim@firm.ca" }, SID, "x/recording.mp4")).toBe(`kim-firm-ca-${SID}.mp4`)
    expect(downloadName({ name: "###" }, SID, "x/recording.mp4")).toBe(`recording-${SID}.mp4`)
  })
  it("never lets a quote or slash into the header", () => {
    expect(downloadName({ name: 'Dan"; x=y' }, SID, "x/recording.mp4")).toBe(`dan-x-y-${SID}.mp4`)
  })
})

const META = {
  name: `studio/${SID}/recording.mp4`,
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
      listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`, `studio/${SID}/request.json`] } },
      meta: { [`studio/${SID}/recording.mp4`]: META },
      media: { [`studio/${SID}/request.json`]: REQUEST },
    })
    const s = await loadSubmission(bucket, SID)
    expect(s).toMatchObject({
      id: SID,
      status: "requested",
      email: "req@x",
      name: "Dan Jeong",
      seconds: 62,
      recordedAt: META.timeCreated,
      requestedAt: REQUEST.createdAt,
      consent: "I agree",
      problems: [],
    })
    expect(s?.recording?.url?.endsWith(`/o/studio%2F${SID}%2Frecording.mp4?alt=media&token=tok1`)).toBe(true)
    expect(s?.recording).toMatchObject({ name: `studio/${SID}/recording.mp4`, contentType: "video/mp4", bytes: 1234 })
  })

  it("falls back to the recording's metadata for what request.json leaves out", async () => {
    const partial = Object.fromEntries(Object.entries(REQUEST).filter(([key]) => key !== "email" && key !== "recordingSeconds"))
    const bucket = fakeBucket({
      listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`, `studio/${SID}/request.json`] } },
      meta: { [`studio/${SID}/recording.mp4`]: META },
      media: { [`studio/${SID}/request.json`]: partial },
    })
    expect(await loadSubmission(bucket, SID)).toMatchObject({ status: "requested", email: "meta@x", seconds: 61 })
  })

  it("reads a recording-only folder from the object metadata", async () => {
    const bucket = fakeBucket({ listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.webm`] } }, meta: { [`studio/${SID}/recording.webm`]: META } })
    const s = await loadSubmission(bucket, SID)
    expect(s).toMatchObject({ status: "recorded", email: "meta@x", seconds: 61, problems: [] })
    expect(s?.requestedAt).toBeUndefined()
  })

  it("reads the uploader's own metadata as carefully as request.json", async () => {
    const bucket = fakeBucket({
      listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.webm`] } },
      meta: { [`studio/${SID}/recording.webm`]: { ...META, size: "big", metadata: { email: "x@y.com?bcc=evil@z.com", seconds: "lots" } } },
    })
    const s = await loadSubmission(bucket, SID)
    expect(s?.email).toBeUndefined()
    expect(s?.seconds).toBeUndefined()
    expect(s?.recording?.bytes).toBeUndefined()
  })

  it("is null for a folder with nothing in it", async () => {
    const bucket = fakeBucket({ listings: {} })
    expect(await loadSubmission(bucket, "20261009T211755-00000000")).toBeNull()
  })

  it("keeps the request when the recording is missing, and says so", async () => {
    const bucket = fakeBucket({ listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/request.json`] } }, media: { [`studio/${SID}/request.json`]: REQUEST } })
    const s = await loadSubmission(bucket, SID)
    expect(s).toMatchObject({ status: "requested", name: "Dan Jeong", problems: [{ kind: "no-recording" }] })
    expect(s?.recording).toBeUndefined()
  })

  it("has no player without a download token but still offers the file and knows when it was recorded", async () => {
    const bucket = fakeBucket({
      listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`] } },
      meta: { [`studio/${SID}/recording.mp4`]: { ...META, downloadTokens: undefined } },
    })
    const s = await loadSubmission(bucket, SID)
    expect(s?.recording).toEqual({ name: `studio/${SID}/recording.mp4`, contentType: "video/mp4", bytes: 1234 })
    expect(s?.recordedAt).toBe(META.timeCreated)
    expect(s?.problems).toEqual([{ kind: "no-token" }])
  })

  it("reports an unreadable recording or request without losing the other half", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    const bucket = fakeBucket({
      listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`, `studio/${SID}/request.json`] } },
      meta: { [`studio/${SID}/recording.mp4`]: 500 },
      media: { [`studio/${SID}/request.json`]: "not json" },
    })
    const s = await loadSubmission(bucket, SID)
    expect(s?.problems.map((p) => p.kind).sort()).toEqual(["meta-unreadable", "request-unreadable"])
    expect(s?.problems.find((p) => p.kind === "meta-unreadable")?.detail).toContain("500")
    expect(s?.status).toBe("request-unreadable")
    expect(s?.recording).toEqual({ name: `studio/${SID}/recording.mp4` })
    expect(quiet).toHaveBeenCalledWith(expect.stringContaining(`request.json in studio/${SID}`), expect.anything())
  })

  it("says what a request.json that isn't an object was, rather than blaming a missing topic", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const bucket = fakeBucket({
      listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`, `studio/${SID}/request.json`] } },
      meta: { [`studio/${SID}/recording.mp4`]: META },
      media: { [`studio/${SID}/request.json`]: ["x"] },
    })
    const s = await loadSubmission(bucket, SID)
    expect(s?.status).toBe("request-unreadable")
    expect(s?.problems).toEqual([{ kind: "request-unreadable", detail: "request.json is an array, not an object" }])
  })

  it("doesn't call a request.json without a topic a picked topic", async () => {
    const bucket = fakeBucket({
      listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`, `studio/${SID}/request.json`] } },
      meta: { [`studio/${SID}/recording.mp4`]: META },
      media: { [`studio/${SID}/request.json`]: { name: "Dan" } },
    })
    const s = await loadSubmission(bucket, SID)
    expect(s?.status).toBe("request-unreadable")
    expect(s?.name).toBe("Dan")
    expect(s?.problems).toEqual([{ kind: "request-unreadable", detail: "no topicTitle" }])
  })

  it("lets a refused read (the service account's credentials or IAM) reach the route instead of hiding it per file", async () => {
    const refused = fakeBucket({ listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`] } }, meta: { [`studio/${SID}/recording.mp4`]: 403 } })
    await expect(loadSubmission(refused, SID)).rejects.toBeInstanceOf(StorageError)
    const bucket = fakeBucket({ listings: { [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`] } }, meta: { [`studio/${SID}/recording.mp4`]: 401 } })
    await expect(loadSubmission(bucket, SID)).rejects.toMatchObject({ status: 401 })
  })
})

describe("loadSubmissions", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("walks every submission, newest first by request then recording time", async () => {
    const [OLD, NEW, MID] = ["20261001T000000-0000000a", "20261002T000000-0000000b", "20261005T000000-0000000c"]
    const objects: Bucket = {
      listings: {
        "studio/": { prefixes: [`studio/${OLD}/`, `studio/${NEW}/`, `studio/${MID}/`] },
        [`studio/${OLD}/`]: { items: [`studio/${OLD}/recording.mp4`] },
        [`studio/${NEW}/`]: { items: [`studio/${NEW}/recording.mp4`, `studio/${NEW}/request.json`] },
        [`studio/${MID}/`]: { items: [`studio/${MID}/recording.mp4`] },
      },
      meta: {
        [`studio/${OLD}/recording.mp4`]: { ...META, timeCreated: "2026-10-01T00:00:00.000Z" },
        [`studio/${NEW}/recording.mp4`]: { ...META, timeCreated: "2026-10-02T00:00:00.000Z" },
        [`studio/${MID}/recording.mp4`]: { ...META, timeCreated: "2026-10-05T00:00:00.000Z" },
      },
      media: { [`studio/${NEW}/request.json`]: { ...REQUEST, createdAt: "2026-10-09T00:00:00.000Z" } },
    }
    expect((await loadSubmissions(fakeBucket(objects))).map((s) => s.id)).toEqual([NEW, MID, OLD])
  })

  it("skips a folder that isn't a submission (an old studio/{uid}/ one) and keeps the rest", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    const bucket = fakeBucket({
      listings: {
        "studio/": { prefixes: [`studio/${SID}/`, "studio/Mi0wDogzIVNDXijAoKNXPoRJdCX2/"] },
        [`studio/${SID}/`]: { items: [`studio/${SID}/recording.mp4`] },
      },
      meta: { [`studio/${SID}/recording.mp4`]: META },
    })
    expect((await loadSubmissions(bucket)).map((s) => s.id)).toEqual([SID])
    expect(quiet).toHaveBeenCalledWith(expect.stringContaining("studio/Mi0wDogzIVNDXijAoKNXPoRJdCX2/"))
  })

  it("reads every folder when the submissions run past one batch", async () => {
    const ids = Array.from({ length: 24 }, (_, i) => `20261009T2117${String(i).padStart(2, "0")}-393dbaa7`)
    const objects: Bucket = { listings: { "studio/": { prefixes: ids.map((id) => `studio/${id}/`) } }, meta: {} }
    for (const id of ids) {
      objects.listings[`studio/${id}/`] = { items: [`studio/${id}/recording.mp4`] }
      objects.meta![`studio/${id}/recording.mp4`] = META
    }
    const loaded = await loadSubmissions(fakeBucket(objects))
    expect(loaded.map((s) => s.id).sort()).toEqual(ids)
  })

  it("is empty when nobody has recorded", async () => {
    const bucket = fakeBucket({ listings: { "studio/": {} } })
    expect(await loadSubmissions(bucket)).toEqual([])
  })
})
