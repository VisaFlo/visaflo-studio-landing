import { describe, expect, it } from "vitest"

import { checkFlags, describeChecks, FACE_MIN_FRAMES, faceVerdict, parseChecks } from "@/lib/studio/checks"

describe("parseChecks", () => {
  it("keeps true, false and null (not checked) and drops anything else", () => {
    expect(parseChecks({ faceSeen: true, voiceHeard: false })).toEqual({ faceSeen: true, voiceHeard: false })
    expect(parseChecks({ faceSeen: null, voiceHeard: true })).toEqual({ faceSeen: null, voiceHeard: true })
    expect(parseChecks({ faceSeen: "yes", voiceHeard: 1 })).toEqual({ faceSeen: null, voiceHeard: null })
  })
  it("is undefined when there were no checks at all", () => {
    expect(parseChecks(undefined)).toBeUndefined()
    expect(parseChecks(null)).toBeUndefined()
    expect(parseChecks("x")).toBeUndefined()
    expect(parseChecks([])).toBeUndefined()
  })
})

describe("checkFlags", () => {
  it("names what failed and what never ran, and nothing when all is well", () => {
    expect(checkFlags({ faceSeen: true, voiceHeard: true })).toEqual([])
    expect(checkFlags({ faceSeen: false, voiceHeard: true })).toEqual(["No face seen"])
    expect(checkFlags({ faceSeen: null, voiceHeard: false })).toEqual(["Face check didn't run", "No voice heard"])
    expect(checkFlags({ faceSeen: true, voiceHeard: null })).toEqual(["Voice check didn't run"])
  })
  it("says so when a finished request carries no checks at all, so it can't pass for a clean take", () => {
    expect(checkFlags(undefined)).toEqual(["Checks not recorded"])
  })
})

describe("describeChecks", () => {
  it("reads like the team email", () => {
    expect(describeChecks({ faceSeen: true, voiceHeard: null })).toBe("face seen, voice not checked")
    expect(describeChecks({ faceSeen: false, voiceHeard: false })).toBe("NO FACE SEEN, NO VOICE HEARD")
    expect(describeChecks({ faceSeen: null, voiceHeard: true })).toBe("face not checked, voice heard")
  })
})

describe("faceVerdict", () => {
  it("lets the framing step's reading stand until the tracker has two seconds of recording", () => {
    expect(faceVerdict({ total: 0, found: 0 }, null)).toBeNull()
    expect(faceVerdict({ total: 0, found: 0 }, true)).toBe(true)
    expect(faceVerdict({ total: FACE_MIN_FRAMES - 1, found: FACE_MIN_FRAMES - 1 }, false)).toBe(false)
  })
  it("then needs the face in at least half of the readings", () => {
    expect(faceVerdict({ total: FACE_MIN_FRAMES, found: FACE_MIN_FRAMES / 2 }, false)).toBe(true)
    expect(faceVerdict({ total: FACE_MIN_FRAMES, found: FACE_MIN_FRAMES / 2 - 1 }, true)).toBe(false)
  })
})
