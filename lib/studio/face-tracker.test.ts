import { describe, expect, it } from "vitest"

import { checkAlignment, faceGeometry, GUIDE, type FaceFrame } from "@/lib/studio/face-tracker"

const face = (patch: Partial<Extract<FaceFrame, { found: true }>>): FaceFrame => ({
  found: true,
  cx: 0.5,
  cy: 0.4,
  size: 0.45,
  light: 120,
  ...patch,
})

describe("checkAlignment for the vertical frame", () => {
  it("passes a face centred in the upper middle of the frame, phone-selfie sized, in decent light", () => {
    expect(checkAlignment(face({}))).toEqual({ inFrame: true, distance: "ok", light: true })
  })

  it("asks for the face to be centred when it drifts to the side or too low", () => {
    expect(checkAlignment(face({ cx: 0.7 }))?.inFrame).toBe(false)
    expect(checkAlignment(face({ cy: 0.62 }))?.inFrame).toBe(false)
  })

  it("asks to come closer or move back from the face's share of the frame width", () => {
    expect(checkAlignment(face({ size: 0.22 }))?.distance).toBe("closer")
    expect(checkAlignment(face({ size: 0.7 }))?.distance).toBe("back")
  })

  it("flags dim light and reports nothing without a face", () => {
    expect(checkAlignment(face({ light: 40 }))?.light).toBe(false)
    expect(checkAlignment({ found: false })).toBeNull()
  })

  it("holds the guide's numbers exactly at the edges", () => {
    expect(checkAlignment(face({ cx: GUIDE.cx + GUIDE.tolerance }))?.inFrame).toBe(false)
    expect(checkAlignment(face({ cx: GUIDE.cx + GUIDE.tolerance - 0.001 }))?.inFrame).toBe(true)
    expect(checkAlignment(face({ size: GUIDE.minSize }))?.distance).toBe("ok")
    expect(checkAlignment(face({ size: GUIDE.maxSize }))?.distance).toBe("ok")
    expect(checkAlignment(face({ light: GUIDE.minLight }))?.light).toBe(true)
    expect(checkAlignment(face({ light: GUIDE.minLight - 0.1 }))?.light).toBe(false)
  })
})

describe("faceGeometry", () => {
  // Landmarks all at one spot except the two that set the width.
  const points = (left: number, right: number, y = 0.4) => [{ x: left, y }, { x: right, y }, { x: (left + right) / 2, y }]

  it("measures a laptop (16:9) face inside the middle 9:16 column, mirrored", () => {
    const g = faceGeometry(points(0.4, 0.5), 1920, 1080)
    // Crop is x 656..1264 (608 wide); the face centre at 864 px is 208 px in,
    // which mirrors to the right-hand side of the preview.
    expect(g.cx).toBeCloseTo(1 - 208 / 608, 3)
    expect(g.cy).toBeCloseTo(0.4, 5)
    expect(g.size).toBeCloseTo(192 / 608, 3)
    expect(g.box).toEqual({ x: 768, y: 432, w: 192, h: 0 })
  })

  it("uses the whole frame for a portrait camera", () => {
    const g = faceGeometry(points(0.4, 0.5), 1080, 1920)
    expect(g.cx).toBeCloseTo(1 - 0.45, 5)
    expect(g.size).toBeCloseTo(0.1, 5)
  })
})
