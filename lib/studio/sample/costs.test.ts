import { describe, expect, it } from "vitest"

import { audioCost, ttsCost, videoCost } from "@/lib/studio/sample/costs"

describe("costs", () => {
  it("prices each method for a 26 s clip", () => {
    expect(videoCost("real", 26)).toBeCloseTo(2.17, 2) // 26/60 * 5
    expect(videoCost("scene", 26)).toBeCloseTo(26 * 0.144 + 2.17, 2)
    expect(videoCost("portrait", 26)).toBeCloseTo(26 * 0.16, 2)
  })
  it("prices the standard lipsync model lower", () => {
    expect(videoCost("real", 26, "standard")).toBeCloseTo(1.3, 2) // 26/60 * 3
  })
  it("prices audio and tts", () => {
    expect(audioCost(26)).toBeCloseTo(((26 + 3) / 60) * 0.15 + 2 * 0.12, 2)
    expect(ttsCost(450)).toBeCloseTo(0.036, 3)
  })
})
