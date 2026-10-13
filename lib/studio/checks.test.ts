import { describe, expect, it } from "vitest"

import { checkFlags, describeChecks, FACE_MIN_FRAMES, faceVerdict, markPlayable, parseChecks } from "@/lib/studio/checks"

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

describe("parseChecks: the review's playback result", () => {
  it("is carried only when the browser sent a yes or a no", () => {
    expect(parseChecks({ faceSeen: true, voiceHeard: true, playable: false })).toStrictEqual({ faceSeen: true, voiceHeard: true, playable: false })
    expect(parseChecks({ faceSeen: true, voiceHeard: true, playable: "x" })).toStrictEqual({ faceSeen: true, voiceHeard: true })
    expect(parseChecks({ faceSeen: true, voiceHeard: true, playable: null })).toStrictEqual({ faceSeen: true, voiceHeard: true })
    expect(parseChecks({ faceSeen: true, voiceHeard: true })).toStrictEqual({ faceSeen: true, voiceHeard: true })
  })
})

describe("markPlayable", () => {
  const measured = { faceSeen: true, voiceHeard: true }

  it("adds the player's verdict to measured checks, and a no sticks for the take", () => {
    expect(markPlayable(measured, true)).toStrictEqual({ ...measured, playable: true })
    expect(markPlayable({ ...measured, playable: false }, true)).toStrictEqual({ ...measured, playable: false })
    expect(markPlayable({ ...measured, playable: true }, false)).toStrictEqual({ ...measured, playable: false })
  })
  it("returns the same object when nothing changes, so a replay doesn't re-render the flow", () => {
    const checks = { ...measured, playable: true }
    expect(markPlayable(checks, true)).toBe(checks)
  })
  it("doesn't invent measurements for a take that has none, except to record that it wouldn't play", () => {
    expect(markPlayable(undefined, true)).toBeUndefined()
    expect(markPlayable(undefined, false)).toStrictEqual({ faceSeen: null, voiceHeard: null, playable: false })
  })
})

describe("checkFlags", () => {
  it("names what failed and what never ran, and nothing when all is well", () => {
    expect(checkFlags({ faceSeen: true, voiceHeard: true })).toEqual([])
    expect(checkFlags({ faceSeen: false, voiceHeard: true })).toEqual(["No face seen"])
    expect(checkFlags({ faceSeen: null, voiceHeard: false })).toEqual(["Face check didn't run", "No voice heard"])
    expect(checkFlags({ faceSeen: true, voiceHeard: null })).toEqual(["Voice check didn't run"])
  })
  it("flags a take the review player couldn't play, and nothing when it could or wasn't tried", () => {
    expect(checkFlags({ faceSeen: true, voiceHeard: true, playable: false })).toEqual(["Review couldn't play it"])
    expect(checkFlags({ faceSeen: true, voiceHeard: true, playable: true })).toEqual([])
    expect(checkFlags({ faceSeen: true, voiceHeard: true })).toEqual([])
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
    expect(describeChecks({ faceSeen: true, voiceHeard: true, playable: false })).toBe("face seen, voice heard, REVIEW COULDN'T PLAY IT")
    expect(describeChecks({ faceSeen: true, voiceHeard: true, playable: true })).toBe("face seen, voice heard")
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
