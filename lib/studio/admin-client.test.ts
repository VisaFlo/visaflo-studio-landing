import { describe, expect, it } from "vitest"

import { describeLoadError } from "@/lib/studio/admin-client"

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
