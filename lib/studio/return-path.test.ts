import { describe, expect, it } from "vitest"

import { returnPath } from "@/lib/studio/return-path"

describe("returnPath", () => {
  it("sends admin pages back where they came from", () => {
    expect(returnPath("/admin")).toBe("/admin")
    expect(returnPath("/admin/abc123/20261009T120000-1a2b3c4d")).toBe("/admin/abc123/20261009T120000-1a2b3c4d")
  })
  it("falls back to /start for anything else", () => {
    expect(returnPath(null)).toBe("/start")
    expect(returnPath("")).toBe("/start")
    expect(returnPath("https://evil.example/admin")).toBe("/start")
    expect(returnPath("//evil.example")).toBe("/start")
    expect(returnPath("/admin/../x")).toBe("/start")
    expect(returnPath("/settings")).toBe("/start")
  })
})
