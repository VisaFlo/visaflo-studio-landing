import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError, apiError, describeLoadError, describeSubmitError } from "@/lib/studio/errors"

const firebaseError = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code })

describe("ApiError", () => {
  it("is told apart from any other Error in a log line", () => {
    const error = new ApiError("Pick a topic first.")
    expect(error.name).toBe("ApiError")
    expect(error.message).toBe("Pick a topic first.")
    expect(error).toBeInstanceOf(Error)
  })
})

describe("apiError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses the route's own message when it wrote one", () => {
    expect(apiError("/api/x", 400, JSON.stringify({ error: "Pick a topic first." })).message).toBe("Pick a topic first.")
    expect(console.error).not.toHaveBeenCalled()
  })
  it("never shows an error that isn't a string, and names the status instead", () => {
    expect(apiError("/api/x", 500, JSON.stringify({ error: { code: "x", message: "y" } })).message).toBe("Request failed (500). Try again.")
  })
  it("logs a body that isn't JSON (a gateway page) with its status", () => {
    const error = apiError("/api/x", 504, "<html>Gateway timeout</html>")
    expect(error.message).toBe("Request failed (504). Try again.")
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("/api/x"), 504, expect.stringContaining("Gateway timeout"))
  })
})

describe("describeLoadError", () => {
  it("tells a dropped connection from a dead session", () => {
    expect(describeLoadError(firebaseError("auth/network-request-failed"))).toBe("No connection. Check your internet, then reload.")
    expect(describeLoadError(new TypeError("Failed to fetch"))).toBe("No connection. Check your internet, then reload.")
    expect(describeLoadError(new TypeError("Load failed"))).toBe("No connection. Check your internet, then reload.")
    expect(describeLoadError(new TypeError("NetworkError when attempting to fetch resource."))).toBe("No connection. Check your internet, then reload.")
    expect(describeLoadError(firebaseError("auth/user-token-expired"))).toBe("Your session is no longer valid. Sign out and sign in again.")
    expect(describeLoadError(firebaseError("auth/user-disabled"))).toBe("Your session is no longer valid. Sign out and sign in again.")
  })
  it("doesn't blame the connection for a TypeError of our own making", () => {
    expect(describeLoadError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
      "Something went wrong (Cannot read properties of undefined (reading 'x')). Reload to try again.",
    )
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
  it("sends a dead session back to sign-in rather than asking for a retry that can't work", () => {
    expect(describeSubmitError(firebaseError("auth/user-token-expired"))).toBe("Your session is no longer valid. Sign out and sign in again.")
    expect(describeSubmitError(firebaseError("auth/invalid-user-token"))).toBe("Your session is no longer valid. Sign out and sign in again.")
  })
  it("tells a dropped connection apart", () => {
    expect(describeSubmitError(new TypeError("Load failed"))).toBe("No connection. Check your internet, then retry.")
    expect(describeSubmitError(firebaseError("auth/network-request-failed"))).toBe("No connection. Check your internet, then retry.")
  })
  it("never shows raw SDK text for anything else, but keeps the code to look up", () => {
    expect(describeSubmitError(firebaseError("storage/quota-exceeded"))).toBe("We couldn't send your request (storage/quota-exceeded). Try again.")
    expect(describeSubmitError(new Error("Firebase Storage: An unknown error occurred (storage/unknown)"))).toBe(
      "We couldn't send your request. Try again.",
    )
    expect(describeSubmitError(undefined)).toBe("We couldn't send your request. Try again.")
  })
})
