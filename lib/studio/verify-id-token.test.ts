import { describe, expect, it } from "vitest"

import { bearerToken, verifyFailure } from "@/lib/studio/verify-id-token"

const jose = (code: string) => Object.assign(new Error(code), { code })

describe("verifyFailure", () => {
  it("asks for a fresh sign-in only when the token really expired", () => {
    expect(verifyFailure(jose("ERR_JWT_EXPIRED"))).toEqual({ status: 401, message: "Your sign-in expired. Sign in again, then retry." })
  })
  it("treats a key-set outage as temporary, not as the person's fault", () => {
    expect(verifyFailure(jose("ERR_JWKS_TIMEOUT")).status).toBe(503)
    expect(verifyFailure(new TypeError("fetch failed")).status).toBe(503)
  })
  it("rejects a bad token without blaming expiry", () => {
    const failure = verifyFailure(jose("ERR_JWT_CLAIM_VALIDATION_FAILED"))
    expect(failure.status).toBe(401)
    expect(failure.message).toBe("We couldn't verify your sign-in. Sign out and sign in again.")
  })
})

describe("bearerToken", () => {
  it("reads only a Bearer header", () => {
    expect(bearerToken(new Request("http://x", { headers: { authorization: "Bearer abc" } }))).toBe("abc")
    expect(bearerToken(new Request("http://x", { headers: { authorization: "Token abc" } }))).toBeNull()
    expect(bearerToken(new Request("http://x"))).toBeNull()
  })
})
