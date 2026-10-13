import { describe, expect, it } from "vitest"

import { actualCrop, portraitCrop } from "@/lib/studio/portrait"

describe("portraitCrop", () => {
  it("takes the middle 9:16 column of a landscape webcam frame, at an even width", () => {
    expect(portraitCrop(1920, 1080)).toEqual({ x: 656, y: 0, w: 608, h: 1080 })
    expect(portraitCrop(1280, 720)).toEqual({ x: 437, y: 0, w: 406, h: 720 })
  })

  it("keeps a phone's 9:16 frame whole, and anything taller", () => {
    expect(portraitCrop(1080, 1920)).toEqual({ x: 0, y: 0, w: 1080, h: 1920 })
    expect(portraitCrop(1080, 2340)).toEqual({ x: 0, y: 0, w: 1080, h: 2340 })
  })

  it("measures a 3:4 phone frame by its middle 9:16 column, which is what the cover-fit preview shows", () => {
    // The recording itself keeps the whole 3:4 frame (portraitStream returns
    // a portrait camera as is); only the face check uses this crop.
    expect(portraitCrop(1080, 1440)).toEqual({ x: 135, y: 0, w: 810, h: 1440 })
  })
})

describe("actualCrop", () => {
  const reported = { width: 1920, height: 1080 }

  it("keeps the whole frame when a camera that claimed landscape delivers portrait", () => {
    expect(actualCrop(reported, { width: 1080, height: 1920 })).toEqual({ x: 0, y: 0, w: 1080, h: 1920 })
  })
  it("recrops a landscape frame of a different size", () => {
    expect(actualCrop(reported, { width: 1280, height: 720 })).toEqual({ x: 437, y: 0, w: 406, h: 720 })
  })
  it("leaves the crop alone when the frames match what was claimed, or aren't known yet", () => {
    expect(actualCrop(reported, { width: 1920, height: 1080 })).toBeNull()
    expect(actualCrop(reported, { width: 0, height: 0 })).toBeNull()
  })
})
