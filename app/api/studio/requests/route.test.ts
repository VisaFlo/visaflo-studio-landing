import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { sendStudioRequestEmail } from "@/lib/studio-request-mail"
import { verifyIdToken } from "@/lib/studio/verify-id-token"

import { POST } from "./route"

vi.mock("@/lib/studio/verify-id-token", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/verify-id-token")>()),
  verifyIdToken: vi.fn(),
}))
vi.mock("@/lib/studio-request-mail", () => ({ sendStudioRequestEmail: vi.fn(async () => {}) }))

const verify = vi.mocked(verifyIdToken)
const mail = vi.mocked(sendStudioRequestEmail)

const BODY = {
  submissionId: "20261009T211755-393dbaa7",
  recordingPath: "studio/u1/20261009T211755-393dbaa7/recording.mp4",
  recordingSeconds: 61.4,
  name: "Dan",
  firm: "Firm",
  topicTitle: "Family",
  consent: "I agree",
  consentAt: "2026-10-09T21:19:00.000Z",
}
const postRaw = (body: string) =>
  POST(new Request("http://x/api/studio/requests", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body }))
const post = (body: unknown) => postRaw(JSON.stringify(body))

describe("POST /api/studio/requests", () => {
  beforeEach(() => {
    verify.mockReset()
    mail.mockClear()
    verify.mockResolvedValue({ uid: "u1", email: "dan@firm.ca", emailVerified: true })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("answers 503, not 401, when Google's key set can't be reached", async () => {
    verify.mockRejectedValue(Object.assign(new Error("ERR_JWKS_TIMEOUT"), { code: "ERR_JWKS_TIMEOUT" }))
    expect((await post(BODY)).status).toBe(503)
    expect(console.error).toHaveBeenCalled()
  })

  it("answers 401 quietly for an expired token", async () => {
    verify.mockRejectedValue(Object.assign(new Error("ERR_JWT_EXPIRED"), { code: "ERR_JWT_EXPIRED" }))
    expect((await post(BODY)).status).toBe(401)
    expect(console.error).not.toHaveBeenCalled()
  })

  it("only accepts a recording under the caller's own folder", async () => {
    expect((await post({ ...BODY, recordingPath: "studio/u2/20261009T211755-393dbaa7/recording.mp4" })).status).toBe(400)
    expect((await post({ ...BODY, recordingPath: "studio/u1/20261009T211755-393dbaa7/recording.txt" })).status).toBe(400)
    expect((await post({ ...BODY, submissionId: "../x" })).status).toBe(400)
    expect(mail).not.toHaveBeenCalled()
    // A client bug or someone probing: worth a line with the uid.
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("u1"), expect.anything())
  })

  it("refuses an over-long id even when truncating it would name a folder the caller owns", async () => {
    const sent = "a".repeat(70)
    expect((await post({ ...BODY, submissionId: sent, recordingPath: `studio/u1/${sent.slice(0, 64)}/recording.mp4` })).status).toBe(400)
    expect(mail).not.toHaveBeenCalled()
  })

  it("logs the other refusals too: a body that isn't JSON or isn't an object, no topic, a bad consent time", async () => {
    expect((await postRaw("not json")).status).toBe(400)
    expect((await postRaw("null")).status).toBe(400)
    expect((await postRaw("[1]")).status).toBe(400)
    expect((await post({ ...BODY, topicTitle: "" })).status).toBe(400)
    expect((await post({ ...BODY, consentAt: "yesterday" })).status).toBe(400)
    expect(console.error).toHaveBeenCalledTimes(5)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("u1"), expect.anything())
  })

  it("mails the team what it was sent, with checks read field by field and a missing one as null", async () => {
    const response = await post({ ...BODY, checks: { faceSeen: true } })
    expect(response.status).toBe(200)
    expect(mail).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "u1",
        email: "dan@firm.ca",
        recordingSeconds: 61,
        recordingSource: "camera",
        checks: { faceSeen: true, voiceHeard: null },
        topicTitle: "Family",
      }),
    )
  })

  it("logs at most 300 characters of a body that isn't an object", async () => {
    const body = JSON.stringify(Array(400).fill("x"))
    expect((await postRaw(body)).status).toBe(400)
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("u1"), body.slice(0, 300))
  })

  it("logs checks it can't read, since this client always sends an object, and mails the request without them", async () => {
    const response = await post({ ...BODY, checks: "yes" })
    expect(response.status).toBe(200)
    expect(mail.mock.calls[0][0].checks).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("u1"), '"yes"')
  })

  it("never lets an infinite length reach the email (1e999 parses as Infinity)", async () => {
    // Raw text: JSON.stringify would have turned 1e999 into null.
    const body = JSON.stringify(BODY).replace("61.4", "1e999")
    expect((await postRaw(body)).status).toBe(200)
    expect(mail.mock.calls[0][0].recordingSeconds).toBe(0)
  })

  it("leaves checks out when the browser sent none", async () => {
    await post(BODY)
    expect(mail.mock.calls[0][0].checks).toBeUndefined()
  })

  it("passes a token without an email on as no email, not as the word unknown", async () => {
    verify.mockResolvedValue({ uid: "u1", emailVerified: false })
    await post(BODY)
    expect(mail.mock.calls[0][0].email).toBeUndefined()
  })

  it("tells the person when the email didn't go out", async () => {
    mail.mockRejectedValueOnce(new Error("SendGrid 500"))
    const response = await post(BODY)
    expect(response.status).toBe(500)
    expect(((await response.json()) as { error: string }).error).toContain("couldn't send")
  })
})
