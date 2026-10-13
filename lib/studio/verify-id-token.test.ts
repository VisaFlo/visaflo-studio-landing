import { afterEach, describe, expect, it, vi } from "vitest"

import { bearerToken, verifyFailure, verifyIdToken } from "@/lib/studio/verify-id-token"

const jose = (code: string) => Object.assign(new Error(code), { code })

describe("verifyFailure", () => {
  it("asks for a fresh sign-in only when the token really expired", () => {
    expect(verifyFailure(jose("ERR_JWT_EXPIRED"))).toEqual({ kind: "expired", status: 401, message: "Your sign-in expired. Sign in again, then retry." })
  })
  it("treats a key-set outage as temporary, not as the person's fault", () => {
    expect(verifyFailure(jose("ERR_JWKS_TIMEOUT"))).toMatchObject({ kind: "unreachable", status: 503 })
    expect(verifyFailure(new TypeError("fetch failed"))).toMatchObject({ kind: "unreachable", status: 503 })
  })
  it("rejects a bad token without blaming expiry", () => {
    const failure = verifyFailure(jose("ERR_JWT_CLAIM_VALIDATION_FAILED"))
    expect(failure).toMatchObject({ kind: "invalid", status: 401 })
    expect(failure.message).toBe("We couldn't verify your sign-in. Sign out and sign in again.")
  })
})

// An unsigned token, the shape the Auth emulator hands out.
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
const unsigned = (claims: object) => `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`
const CLAIMS = { sub: "u1", email: "bkim@vflo.app", email_verified: true }

describe("verifyIdToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("trusts an unsigned token only against the emulator", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_EMULATOR_HOST", "127.0.0.1")
    expect(await verifyIdToken(unsigned(CLAIMS))).toEqual({ uid: "u1", email: "bkim@vflo.app", emailVerified: true })
    await expect(verifyIdToken(unsigned({ email: "x" }))).rejects.toThrow("no subject")
  })

  it("never takes the emulator shortcut in production, even with the host set", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_EMULATOR_HOST", "127.0.0.1")
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ keys: [] })))
    await expect(verifyIdToken(unsigned(CLAIMS))).rejects.toMatchObject({ code: "ERR_JOSE_NOT_SUPPORTED" })
  })
})

describe("bearerToken", () => {
  it("reads only a Bearer header", () => {
    expect(bearerToken(new Request("http://x", { headers: { authorization: "Bearer abc" } }))).toBe("abc")
    expect(bearerToken(new Request("http://x", { headers: { authorization: "Token abc" } }))).toBeNull()
    expect(bearerToken(new Request("http://x"))).toBeNull()
  })
})
