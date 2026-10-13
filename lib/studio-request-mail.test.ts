import { beforeEach, describe, expect, it, vi } from "vitest"

import { sendMail } from "@/lib/sendgrid"
import { sendStudioRequestEmail, type StudioRequestMail } from "@/lib/studio-request-mail"

vi.mock("@/lib/sendgrid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sendgrid")>()),
  sendMail: vi.fn(async () => {}),
}))

const send = vi.mocked(sendMail)
const ENTRY: StudioRequestMail = {
  uid: "u1",
  email: "dan@firm.ca",
  emailVerified: true,
  name: "Dan",
  firm: "Firm",
  topicTitle: "Family",
  submissionId: "s1",
  recordingPath: "studio/u1/s1/recording.mp4",
  recordingSeconds: 61,
  recordingSource: "camera",
  checks: { faceSeen: true, voiceHeard: null },
  consentAt: "2026-10-09T21:19:00.000Z",
}
const sent = () => send.mock.calls[0][0]

describe("sendStudioRequestEmail", () => {
  beforeEach(() => send.mockClear())

  it("tells the team what the checks saw, with a reply-to for the person", async () => {
    await sendStudioRequestEmail(ENTRY)
    expect(sent().text).toContain("1:01 (camera), face seen, voice not checked")
    expect(sent().replyTo).toEqual({ email: "dan@firm.ca", name: "Dan" })
    expect(sent().text).toContain("gs://devdashboard-c9159-ca/studio/u1/s1/recording.mp4")
    expect(sent().text).toContain("studio~2Fu1~2Fs1")
  })

  it("escapes what the person typed before it goes into the HTML", async () => {
    await sendStudioRequestEmail({ ...ENTRY, name: '<b>Dan</b> "x"' })
    expect(sent().html).toContain("&lt;b&gt;Dan&lt;/b&gt;")
    expect(sent().html).not.toContain("<b>Dan</b>")
  })

  it("shouts when the review player couldn't play the take", async () => {
    await sendStudioRequestEmail({ ...ENTRY, checks: { faceSeen: true, voiceHeard: true, playable: false } })
    expect(sent().text).toContain("face seen, voice heard, REVIEW COULDN'T PLAY IT")
  })

  it("says when no checks were sent (an older page build), and when the length is unknown", async () => {
    await sendStudioRequestEmail({ ...ENTRY, checks: undefined, recordingSeconds: 0 })
    expect(sent().text).toContain("length unknown (camera), no checks sent (older page build or a malformed request)")
    expect(sent().text).not.toContain("recovered")
    expect(sent().text).not.toContain("0:00")
  })

  it("leaves reply-to out and says so when the account has no email", async () => {
    await sendStudioRequestEmail({ ...ENTRY, email: undefined })
    expect(sent().replyTo).toBeUndefined()
    expect(sent().text).toContain("no email on the account")
  })

  it("warns about an unverified address before the team uses the face", async () => {
    await sendStudioRequestEmail({ ...ENTRY, emailVerified: false })
    expect(sent().text).toContain("dan@firm.ca (not verified")
  })
})
