import { describe, expect, it } from "vitest"

import { clipLength, megabytes, when } from "@/lib/studio/admin-format"

describe("admin formatters", () => {
  it("shows a dash for missing or unreadable times and lengths", () => {
    expect(when(undefined)).toBe("—")
    expect(when("garbage")).toBe("—")
    expect(clipLength(undefined)).toBe("—")
    expect(clipLength(0)).toBe("—")
  })
  it("formats lengths as m:ss, rounding once", () => {
    expect(clipLength(90)).toBe("1:30")
    expect(clipLength(59.6)).toBe("1:00")
    expect(clipLength(5)).toBe("0:05")
  })
  it("formats sizes in megabytes", () => {
    expect(megabytes(51604544)).toBe("49.2 MB")
  })
})
