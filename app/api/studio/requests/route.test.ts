import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { sendStudioRequestEmail } from "@/lib/studio-request-mail"
import { studioAdmin } from "@/lib/studio/admin-firebase"
import { fakeBucket, type Bucket } from "@/lib/studio/test-bucket"

import { POST } from "./route"

vi.mock("@/lib/studio/admin-firebase", () => ({ studioAdmin: vi.fn() }))
vi.mock("@/lib/studio-request-mail", () => ({ sendStudioRequestEmail: vi.fn(async () => {}) }))

const admin = vi.mocked(studioAdmin)
const mail = vi.mocked(sendStudioRequestEmail)

const SID = "20261009T211755-393dbaa7"
const RECORDING = `studio/${SID}/recording.mp4`
const REQUEST_JSON = `studio/${SID}/request.json`
const PHOTO = `studio/${SID}/photo.jpg`
const BODY = {
  submissionId: SID,
  recordingPath: RECORDING,
  photoPath: PHOTO,
  recordingSeconds: 61.4,
  email: "dan@firm.ca",
  firstName: "Dan",
  lastName: "Jeong",
  firm: "Firm",
  topicId: "family",
  topicTitle: "Family",
  consent: "I agree",
  consentAt: "2026-10-09T21:19:00.000Z",
}
const postRaw = (body: string) =>
  POST(new Request("https://studio.visaflo.ca/api/studio/requests", { method: "POST", headers: { "content-type": "application/json" }, body }))
const post = (body: unknown) => postRaw(JSON.stringify(body))

let bucket: ReturnType<typeof fakeBucket>
function useBucket(setup: Partial<Bucket> = {}) {
  bucket = fakeBucket({ listings: {}, meta: { [RECORDING]: { name: RECORDING }, [PHOTO]: { name: PHOTO } }, ...setup })
  admin.mockReturnValue({ bucket, isMaster: vi.fn() })
}
const saved = () => JSON.parse(bucket.create.mock.calls[0][1]) as Record<string, unknown>

describe("POST /api/studio/requests", () => {
  beforeEach(() => {
    mail.mockClear()
    useBucket()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("keeps what was sent as request.json next to the recording and mails the team", async () => {
    const response = await post({ ...BODY, checks: { faceSeen: true } })
    expect(response.status).toBe(200)
    expect(bucket.create).toHaveBeenCalledWith(REQUEST_JSON, expect.any(String), "application/json")
    expect(saved()).toMatchObject({
      submissionId: SID,
      photoPath: PHOTO,
      email: "dan@firm.ca",
      firstName: "Dan",
      lastName: "Jeong",
      name: "Dan Jeong",
      firm: "Firm",
      topicId: "family",
      topicTitle: "Family",
      recordingSeconds: 61,
      checks: { faceSeen: true, voiceHeard: null },
    })
    expect(mail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "dan@firm.ca",
        name: "Dan Jeong",
        recordingSeconds: 61,
        recordingSource: "camera",
        checks: { faceSeen: true, voiceHeard: null },
        photoPath: PHOTO,
        adminUrl: `https://studio.visaflo.ca/admin/${SID}`,
      }),
    )
  })

  it("only accepts a recording in its own submission's folder, with an id newSubmissionId could make", async () => {
    expect((await post({ ...BODY, recordingPath: `studio/20261009T211755-aaaaaaaa/recording.mp4` })).status).toBe(400)
    expect((await post({ ...BODY, recordingPath: `studio/${SID}/recording.txt` })).status).toBe(400)
    expect((await post({ ...BODY, submissionId: "../x", recordingPath: "studio/../x/recording.mp4" })).status).toBe(400)
    expect((await post({ ...BODY, submissionId: "u1", recordingPath: "studio/u1/recording.mp4" })).status).toBe(400)
    expect(mail).not.toHaveBeenCalled()
    expect(bucket.create).not.toHaveBeenCalled()
  })

  it("only accepts this submission's photo.jpg as the photo", async () => {
    expect((await post({ ...BODY, photoPath: "studio/20261009T211755-aaaaaaaa/photo.jpg" })).status).toBe(400)
    expect((await post({ ...BODY, photoPath: `studio/${SID}/photo.png` })).status).toBe(400)
    expect((await post({ ...BODY, photoPath: 42 })).status).toBe(400)
    expect(mail).not.toHaveBeenCalled()
  })

  it("refuses a request whose photo isn't in the bucket", async () => {
    useBucket({ meta: { [RECORDING]: { name: RECORDING } } })
    const response = await post(BODY)
    expect(response.status).toBe(404)
    expect(((await response.json()) as { error: string }).error).toContain("photo")
    expect(mail).not.toHaveBeenCalled()
  })

  it("still takes a request without a photo from a page that had no photo step", async () => {
    const { photoPath: _unused, ...withoutPhoto } = BODY
    void _unused
    useBucket({ meta: { [RECORDING]: { name: RECORDING } } })
    expect((await post(withoutPhoto)).status).toBe(200)
    expect(saved().photoPath).toBeUndefined()
    expect(mail.mock.calls[0][0].photoPath).toBeUndefined()
  })

  it("refuses a request whose recording isn't in the bucket", async () => {
    useBucket({ meta: { [PHOTO]: { name: PHOTO } } })
    const response = await post(BODY)
    expect(response.status).toBe(404)
    expect(bucket.create).not.toHaveBeenCalled()
    expect(mail).not.toHaveBeenCalled()
  })

  it("needs a usable email, both names and the firm", async () => {
    expect((await post({ ...BODY, email: "x@y.com?bcc=evil@z.com" })).status).toBe(400)
    expect((await post({ ...BODY, email: undefined })).status).toBe(400)
    expect((await post({ ...BODY, firstName: " " })).status).toBe(400)
    expect((await post({ ...BODY, lastName: undefined })).status).toBe(400)
    expect((await post({ ...BODY, firm: "" })).status).toBe(400)
    expect(mail).not.toHaveBeenCalled()
  })

  it("logs the other refusals too: a body that isn't JSON or isn't an object, no topic, a bad consent time", async () => {
    expect((await postRaw("not json")).status).toBe(400)
    expect((await postRaw("null")).status).toBe(400)
    expect((await postRaw("[1]")).status).toBe(400)
    expect((await post({ ...BODY, topicTitle: "" })).status).toBe(400)
    expect((await post({ ...BODY, consentAt: "yesterday" })).status).toBe(400)
    expect(console.error).toHaveBeenCalledTimes(5)
  })

  it("answers a submission that was already sent as done, without mailing it again", async () => {
    useBucket({ meta: { [RECORDING]: { name: RECORDING }, [PHOTO]: { name: PHOTO }, [REQUEST_JSON]: { name: REQUEST_JSON } } })
    expect((await post(BODY)).status).toBe(200)
    expect(bucket.create).not.toHaveBeenCalled()
    // Two sends at once: the check passed for both, and Storage refused the second create.
    useBucket({ creates: { [REQUEST_JSON]: 412 } })
    expect((await post(BODY)).status).toBe(200)
    expect(mail).not.toHaveBeenCalled()
  })

  it("takes request.json back when the email fails, so a retry sends it", async () => {
    mail.mockRejectedValueOnce(new Error("SendGrid 500"))
    const response = await post(BODY)
    expect(response.status).toBe(500)
    expect(((await response.json()) as { error: string }).error).toContain("couldn't send")
    expect(bucket.remove).toHaveBeenCalledWith(REQUEST_JSON)
  })

  it("fails without mailing when the bucket can't be reached or written", async () => {
    useBucket({ meta: { [RECORDING]: 503, [PHOTO]: { name: PHOTO } } })
    expect((await post(BODY)).status).toBe(500)
    useBucket({ creates: { [REQUEST_JSON]: 403 } })
    expect((await post(BODY)).status).toBe(500)
    admin.mockImplementation(() => {
      throw new Error("FIREBASE_CLIENT_EMAIL isn't set on this server.")
    })
    expect((await post(BODY)).status).toBe(500)
    expect(mail).not.toHaveBeenCalled()
  })

  it("logs checks it can't read, since this client always sends an object, and mails the request without them", async () => {
    const response = await post({ ...BODY, checks: "yes" })
    expect(response.status).toBe(200)
    expect(mail.mock.calls[0][0].checks).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(SID), '"yes"')
  })

  it("never lets an infinite length reach the email (1e999 parses as Infinity)", async () => {
    // Raw text: JSON.stringify would have turned 1e999 into null.
    const body = JSON.stringify(BODY).replace("61.4", "1e999")
    expect((await postRaw(body)).status).toBe(200)
    expect(mail.mock.calls[0][0].recordingSeconds).toBe(0)
  })
})
