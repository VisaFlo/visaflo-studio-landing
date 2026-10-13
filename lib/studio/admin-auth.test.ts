import { beforeEach, describe, expect, it, vi } from "vitest"

import { requireAdmin } from "@/lib/studio/admin-auth"
import { AdminConfigError, studioAdmin } from "@/lib/studio/admin-firebase"
import { fakeBucket } from "@/lib/studio/test-bucket"
import { verifyIdToken } from "@/lib/studio/verify-id-token"

vi.mock("@/lib/studio/verify-id-token", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/verify-id-token")>()),
  verifyIdToken: vi.fn(),
}))
vi.mock("@/lib/studio/admin-firebase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/admin-firebase")>()),
  studioAdmin: vi.fn(),
}))

const verify = vi.mocked(verifyIdToken)
const admin = vi.mocked(studioAdmin)
const isMaster = vi.fn<(uid: string) => Promise<boolean>>()
const bucket = fakeBucket({ listings: {} })
const request = (authorization?: string) => new Request("http://x/api/admin/submissions", { headers: authorization ? { authorization } : {} })
const bodyOf = async (r: Response) => (await r.json()) as { error?: string; code?: string }

describe("requireAdmin", () => {
  // Braces matter: beforeEach treats a returned function as a cleanup hook,
  // and mockReset() returns the mock itself.
  beforeEach(() => {
    verify.mockReset()
    isMaster.mockReset()
    admin.mockReset()
    admin.mockReturnValue({ bucket, isMaster })
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
    expect(isMaster).not.toHaveBeenCalled()
  })
  it("returns the master and the server's bucket, checking the uid from the token", async () => {
    verify.mockResolvedValue({ uid: "m1", email: "staff@vflo.app", emailVerified: false })
    isMaster.mockResolvedValue(true)
    const result = await requireAdmin(request("Bearer t"))
    expect(isMaster).toHaveBeenCalledWith("m1")
    expect(result).toEqual({ user: { uid: "m1", email: "staff@vflo.app", emailVerified: false }, bucket })
  })
  it("keeps everyone who isn't a master out, whatever their email", async () => {
    verify.mockResolvedValue({ uid: "u", email: "bkim@vflo.app", emailVerified: true })
    isMaster.mockResolvedValue(false)
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(403)
    expect((await bodyOf(r)).error).toBe("This page is only for VisaFlo master accounts.")
  })
  it("says the server isn't set up, naming what is missing, when the service account isn't configured", async () => {
    verify.mockResolvedValue({ uid: "u", emailVerified: true })
    admin.mockImplementation(() => {
      throw new AdminConfigError("FIREBASE_PRIVATE_KEY isn't set on this server.")
    })
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(500)
    expect((await bodyOf(r)).error).toBe("The admin pages aren't set up on this server: FIREBASE_PRIVATE_KEY isn't set on this server.")
    expect(console.error).toHaveBeenCalled()
  })
  it("is a logged 503 when the profile can't be read, never a pass", async () => {
    verify.mockResolvedValue({ uid: "u", emailVerified: true })
    isMaster.mockRejectedValue(new Error("DEADLINE_EXCEEDED"))
    const r = (await requireAdmin(request("Bearer t"))) as Response
    expect(r.status).toBe(503)
    expect((await bodyOf(r)).error).toBe("We couldn't check your account right now. Try again in a minute.")
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("u"), expect.any(Error))
  })
})
