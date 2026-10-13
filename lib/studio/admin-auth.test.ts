import { beforeEach, describe, expect, it, vi } from "vitest"

import { requireAdmin } from "@/lib/studio/admin-auth"
import { verifyIdToken } from "@/lib/studio/verify-id-token"

vi.mock("@/lib/studio/verify-id-token", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/verify-id-token")>()),
  verifyIdToken: vi.fn(),
}))

const verify = vi.mocked(verifyIdToken)
const request = (authorization?: string) => new Request("http://x/api/admin/submissions", { headers: authorization ? { authorization } : {} })
const bodyOf = async (r: Response) => (await r.json()) as { error?: string; code?: string }

describe("requireAdmin", () => {
  // Braces matter: beforeEach treats a returned function as a cleanup hook,
  // and mockReset() returns the mock itself.
  beforeEach(() => {
    verify.mockReset()
  })

  it("wants a Bearer token", async () => {
    const r = (await requireAdmin(request())) as Response
    expect(r.status).toBe(401)
    expect((await requireAdmin(request("Token x")) as Response).status).toBe(401)
  })
  it("passes verification failures through with their own status", async () => {
    // Not mockRejectedValue: that builds the rejected promise up front, and
    // Vitest reports it as unhandled before requireAdmin ever awaits it.
    verify.mockImplementation(async () => {
      throw Object.assign(new Error("ERR_JWT_EXPIRED"), { code: "ERR_JWT_EXPIRED" })
    })
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(401)
    expect((await bodyOf(r)).error).toContain("expired")
  })
  it("keeps everyone but the admin out, with no hint about verification", async () => {
    verify.mockResolvedValue({ uid: "u", email: "someone@firm.ca", emailVerified: false })
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(403)
    expect((await bodyOf(r)).code).toBeUndefined()
  })
  it("tells the client to show the verify panel for an unverified admin", async () => {
    verify.mockResolvedValue({ uid: "u", email: "bkim@vflo.app", emailVerified: false })
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(403)
    expect((await bodyOf(r)).code).toBe("unverified")
  })
  it("returns the verified admin and the raw token, whatever the email's case", async () => {
    verify.mockResolvedValue({ uid: "u", email: "BKim@vflo.app", emailVerified: true })
    const result = await requireAdmin(request("Bearer the-token"))
    expect(result).toMatchObject({ token: "the-token", user: { uid: "u", email: "BKim@vflo.app", emailVerified: true } })
  })
})
