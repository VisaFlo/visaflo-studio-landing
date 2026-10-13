import { describe, expect, it } from "vitest"

import { describeLoadError, describeSubmitError } from "@/lib/studio/errors"

const firebaseError = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code })

describe("describeLoadError", () => {
  it("tells a dropped connection from a dead session", () => {
    expect(describeLoadError(firebaseError("auth/network-request-failed"))).toBe("No connection. Check your internet, then reload.")
    expect(describeLoadError(new TypeError("Failed to fetch"))).toBe("No connection. Check your internet, then reload.")
    expect(describeLoadError(firebaseError("auth/user-token-expired"))).toBe("Your session is no longer valid. Sign out and sign in again.")
    expect(describeLoadError(firebaseError("auth/user-disabled"))).toBe("Your session is no longer valid. Sign out and sign in again.")
  })
  it("names anything else so it can be looked up", () => {
    expect(describeLoadError(firebaseError("auth/internal-error"))).toBe("Something went wrong (auth/internal-error). Reload to try again.")
    expect(describeLoadError(new Error("boom"))).toBe("Something went wrong (boom). Reload to try again.")
    expect(describeLoadError("??")).toBe("Something went wrong. Reload to try again.")
  })
})

describe("describeSubmitError", () => {
  it("turns a refused request.json write into a sign-in hint", () => {
    expect(describeSubmitError(firebaseError("storage/unauthorized"))).toBe("We couldn't save your request. Sign out and back in, then retry.")
    expect(describeSubmitError(firebaseError("storage/unauthenticated"))).toBe("We couldn't save your request. Sign out and back in, then retry.")
  })
  it("tells a dropped connection apart", () => {
    expect(describeSubmitError(new TypeError("Load failed"))).toBe("No connection. Check your internet, then retry.")
    expect(describeSubmitError(firebaseError("auth/network-request-failed"))).toBe("No connection. Check your internet, then retry.")
  })
  it("never shows raw SDK text for anything else", () => {
    expect(describeSubmitError(new Error("Firebase Storage: An unknown error occurred (storage/unknown)"))).toBe(
      "We couldn't send your request. Try again.",
    )
    expect(describeSubmitError(undefined)).toBe("We couldn't send your request. Try again.")
  })
})
