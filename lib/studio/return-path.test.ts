import { describe, expect, it } from "vitest"

import { returnPath } from "@/lib/studio/return-path"

describe("returnPath", () => {
  it("sends admin pages back where they came from", () => {
    expect(returnPath("/admin")).toBe("/admin")
    expect(returnPath("/admin/20261009T120000-1a2b3c4d")).toBe("/admin/20261009T120000-1a2b3c4d")
  })
  it("has nowhere to return to for anything else", () => {
    expect(returnPath(null)).toBeNull()
    expect(returnPath(undefined)).toBeNull()
    expect(returnPath("")).toBeNull()
    expect(returnPath(["/admin"])).toBeNull()
    expect(returnPath("https://evil.example/admin")).toBeNull()
    expect(returnPath("//evil.example")).toBeNull()
    expect(returnPath("/admin/../x")).toBeNull()
    expect(returnPath("/settings")).toBeNull()
    // Not a loose prefix match either.
    expect(returnPath("/adminx")).toBeNull()
    expect(returnPath("/admin?next=x")).toBeNull()
    expect(returnPath("/ADMIN")).toBeNull()
  })
})
