import { describe, expect, it } from "vitest"

import { checkFlags, describeChecks, parseChecks } from "@/lib/studio/checks"

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
  })
})

describe("checkFlags", () => {
  it("names what failed and what never ran, and nothing when all is well", () => {
    expect(checkFlags({ faceSeen: true, voiceHeard: true })).toEqual([])
    expect(checkFlags({ faceSeen: false, voiceHeard: true })).toEqual(["No face seen"])
    expect(checkFlags({ faceSeen: null, voiceHeard: false })).toEqual(["Face check didn't run", "No voice heard"])
    expect(checkFlags(undefined)).toEqual([])
  })
})

describe("describeChecks", () => {
  it("reads like the team email", () => {
    expect(describeChecks({ faceSeen: true, voiceHeard: null })).toBe("face seen, voice not checked")
    expect(describeChecks({ faceSeen: false, voiceHeard: false })).toBe("NO FACE SEEN, NO VOICE HEARD")
  })
})
