import { beforeEach, describe, expect, it, vi } from "vitest"

import { STUDIO_ADMIN_EMAIL, UNVERIFIED_CODE } from "@/lib/studio/admin"
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
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("wants a Bearer token", async () => {
    const r = (await requireAdmin(request())) as Response
    expect(r.status).toBe(401)
    expect((await requireAdmin(request("Token x")) as Response).status).toBe(401)
  })
  it("passes verification failures through with their own status, logging all but an expiry", async () => {
    verify.mockRejectedValue(Object.assign(new Error("ERR_JWT_EXPIRED"), { code: "ERR_JWT_EXPIRED" }))
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(401)
    expect((await bodyOf(r)).error).toContain("expired")
    expect(console.error).not.toHaveBeenCalled()

    verify.mockRejectedValue(Object.assign(new Error("ERR_JWKS_TIMEOUT"), { code: "ERR_JWKS_TIMEOUT" }))
    expect(((await requireAdmin(request("Bearer t"))) as Response).status).toBe(503)
    expect(console.error).toHaveBeenCalledTimes(1)
  })
  it("keeps everyone but the admin out, with no hint about verification", async () => {
    verify.mockResolvedValue({ uid: "u", email: "someone@firm.ca", emailVerified: false })
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(403)
    expect((await bodyOf(r)).code).toBeUndefined()
  })
  it("tells the client to show the verify panel for an unverified admin", async () => {
    verify.mockResolvedValue({ uid: "u", email: STUDIO_ADMIN_EMAIL, emailVerified: false })
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(403)
    expect((await bodyOf(r)).code).toBe(UNVERIFIED_CODE)
  })
  it("returns the verified admin and the raw token, whatever the email's case", async () => {
    const email = STUDIO_ADMIN_EMAIL.replace(/^./, (c) => c.toUpperCase())
    verify.mockResolvedValue({ uid: "u", email, emailVerified: true })
    const result = await requireAdmin(request("Bearer the-token"))
    expect(result).toMatchObject({ token: "the-token", user: { uid: "u", email, emailVerified: true } })
  })
})
