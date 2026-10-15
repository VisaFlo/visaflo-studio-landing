import { beforeEach, describe, expect, it, vi } from "vitest"

import { sendMail } from "@/lib/sendgrid"
import { sendStudioRequestEmail, type StudioRequestMail } from "@/lib/studio-request-mail"

vi.mock("@/lib/sendgrid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sendgrid")>()),
  sendMail: vi.fn(async () => {}),
}))

const send = vi.mocked(sendMail)
const ENTRY: StudioRequestMail = {
  email: "dan@firm.ca",
  name: "Dan Jeong",
  firm: "Firm",
  topicTitle: "Family",
  submissionId: "20261009T211755-393dbaa7",
  recordingPath: "studio/20261009T211755-393dbaa7/recording.mp4",
  photoPath: "studio/20261009T211755-393dbaa7/photo.jpg",
  recordingSeconds: 61,
  recordingSource: "camera",
  checks: { faceSeen: true, voiceHeard: null },
  consentAt: "2026-10-09T21:19:00.000Z",
  adminUrl: "https://studio.visaflo.ca/admin/20261009T211755-393dbaa7",
}
const sent = () => send.mock.calls[0][0]

describe("sendStudioRequestEmail", () => {
  beforeEach(() => send.mockClear())

  it("tells the team what the checks saw, with a reply-to for the person", async () => {
    await sendStudioRequestEmail(ENTRY)
    expect(sent().text).toContain("1:01 (camera), face seen, voice not checked")
    expect(sent().replyTo).toEqual({ email: "dan@firm.ca", name: "Dan Jeong" })
    expect(sent().text).toContain("Video: gs://devdashboard-c9159-ca/studio/20261009T211755-393dbaa7/recording.mp4")
    expect(sent().text).toContain("Photo: gs://devdashboard-c9159-ca/studio/20261009T211755-393dbaa7/photo.jpg")
    expect(sent().text).toContain("Open it in Studio admin: https://studio.visaflo.ca/admin/20261009T211755-393dbaa7")
  })

  it("says when a request came without a photo (a page from before the photo step)", async () => {
    await sendStudioRequestEmail({ ...ENTRY, photoPath: undefined })
    expect(sent().text).toContain("Photo: — (sent from a page without the photo step)")
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

  it("warns that the typed address isn't verified before the team uses the face", async () => {
    await sendStudioRequestEmail(ENTRY)
    expect(sent().text).toContain("dan@firm.ca (typed, not verified")
  })
})
