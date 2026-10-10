import { describe, expect, it } from "vitest"

import { checkAlignment, type FaceFrame } from "@/lib/studio/face-tracker"

const face = (patch: Partial<Extract<FaceFrame, { found: true }>>): FaceFrame => ({
  found: true,
  cx: 0.5,
  cy: 0.4,
  size: 0.45,
  yaw: 0,
  pitch: 0,
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
})
