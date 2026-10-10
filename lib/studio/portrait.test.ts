import { describe, expect, it } from "vitest"

import { portraitCrop } from "@/lib/studio/portrait"

describe("portraitCrop", () => {
  it("takes the middle 9:16 column of a landscape webcam frame, at an even width", () => {
    expect(portraitCrop(1920, 1080)).toEqual({ x: 656, y: 0, w: 608, h: 1080 })
    expect(portraitCrop(1280, 720)).toEqual({ x: 437, y: 0, w: 406, h: 720 })
  })

  it("keeps a phone's portrait frame whole", () => {
    expect(portraitCrop(1080, 1920)).toEqual({ x: 0, y: 0, w: 1080, h: 1920 })
    // Taller than 9:16 (a full-screen phone sensor) stays whole too; the
    // pipeline fits it to 9:16 later.
    expect(portraitCrop(1080, 2340)).toEqual({ x: 0, y: 0, w: 1080, h: 2340 })
  })
})
