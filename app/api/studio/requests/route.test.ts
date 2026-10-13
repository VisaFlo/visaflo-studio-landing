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
const post = (body: unknown) =>
  POST(new Request("http://x/api/studio/requests", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body) }))

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
    // An over-long id is refused, not truncated into some other id.
    const long = "a".repeat(70)
    expect((await post({ ...BODY, submissionId: long, recordingPath: `studio/u1/${long}/recording.mp4` })).status).toBe(400)
    expect(mail).not.toHaveBeenCalled()
    // A client bug or someone probing: worth a line with the uid.
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

  it("never lets a nonsense length reach the email", async () => {
    await post({ ...BODY, recordingSeconds: 1e999 })
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
