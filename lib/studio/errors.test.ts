import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError, apiError, describeLoadError, describeSubmitError, parseJsonObject, uploadFailureReason } from "@/lib/studio/errors"

const firebaseError = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code })

describe("ApiError", () => {
  it("is told apart from any other Error in a log line", () => {
    const error = new ApiError("Pick a topic first.")
    expect(error.name).toBe("ApiError")
    expect(error.message).toBe("Pick a topic first.")
    expect(error).toBeInstanceOf(Error)
  })
})

describe("parseJsonObject", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns an object body as is", () => {
    expect(parseJsonObject("/api/x", 200, JSON.stringify({ a: 1 }))).toEqual({ a: 1 })
    expect(console.error).not.toHaveBeenCalled()
  })
  it("logs and returns null for JSON that isn't an object", () => {
    expect(parseJsonObject("/api/x", 500, "null")).toBeNull()
    expect(parseJsonObject("/api/x", 500, "[1]")).toBeNull()
    expect(parseJsonObject("/api/x", 500, '"text"')).toBeNull()
    expect(console.error).toHaveBeenCalledTimes(3)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("isn't an object"), 500, "null")
  })
  it("logs and returns null for a body that isn't JSON (a gateway page)", () => {
    expect(parseJsonObject("/api/x", 504, "<html>Gateway timeout</html>")).toBeNull()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("something other than JSON"), 504, expect.stringContaining("Gateway timeout"))
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
    expect(apiError("/api/x", 400, JSON.stringify({ error: " Pick a topic first. " })).message).toBe("Pick a topic first.")
    expect(console.error).not.toHaveBeenCalled()
  })
  it("never shows an error that isn't a non-empty string, names the status instead, and logs the body", () => {
    expect(apiError("/api/x", 500, JSON.stringify({ error: { code: "x", message: "y" } })).message).toBe("Request failed (500). Try again.")
    expect(apiError("/api/x", 500, JSON.stringify({ error: "   " })).message).toBe("Request failed (500). Try again.")
    expect(apiError("/api/x", 500, JSON.stringify({ message: "y" })).message).toBe("Request failed (500). Try again.")
    expect(console.error).toHaveBeenCalledTimes(3)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("without a usable error message"), 500, expect.stringContaining("code"))
  })
  it("logs a body that isn't JSON (a gateway page) with its status", () => {
    const error = apiError("/api/x", 504, "<html>Gateway timeout</html>")
    expect(error.message).toBe("Request failed (504). Try again.")
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("/api/x"), 504, expect.stringContaining("Gateway timeout"))
  })
  it("is an ApiError on every branch, since callers show its message only when it is one", () => {
    expect(apiError("/api/x", 400, JSON.stringify({ error: "Pick a topic first." }))).toBeInstanceOf(ApiError)
    expect(apiError("/api/x", 500, JSON.stringify({ error: { code: "x" } }))).toBeInstanceOf(ApiError)
    expect(apiError("/api/x", 504, "<html>Gateway timeout</html>")).toBeInstanceOf(ApiError)
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
  it("tells a dropped connection apart", () => {
    expect(describeSubmitError(new TypeError("Load failed"))).toBe("No connection. Check your internet, then retry.")
  })
  it("never shows raw text for anything else", () => {
    expect(describeSubmitError(new Error("Something internal"))).toBe("We couldn't send your request. Try again.")
    expect(describeSubmitError(undefined)).toBe("We couldn't send your request. Try again.")
  })
})

describe("uploadFailureReason", () => {
  it("calls only a retry-limit failure a connection problem", () => {
    expect(uploadFailureReason(firebaseError("storage/retry-limit-exceeded"))).toEqual({ reason: "network" })
  })
  it("tells the rules refusing the file apart", () => {
    expect(uploadFailureReason(firebaseError("storage/unauthorized"))).toEqual({ reason: "refused" })
    expect(uploadFailureReason(firebaseError("storage/unauthenticated"))).toEqual({ reason: "refused" })
  })
  it("names anything else rather than blaming the connection, including an error with no code", () => {
    expect(uploadFailureReason(firebaseError("storage/quota-exceeded"))).toEqual({ reason: "other", code: "storage/quota-exceeded" })
    expect(uploadFailureReason(firebaseError("storage/unknown"))).toEqual({ reason: "other", code: "storage/unknown" })
    expect(uploadFailureReason(new RangeError("odd"))).toEqual({ reason: "other", code: "RangeError" })
    expect(uploadFailureReason(undefined)).toEqual({ reason: "other", code: "no code" })
  })
})
