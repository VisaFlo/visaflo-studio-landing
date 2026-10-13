import { describe, expect, it } from "vitest"

import { isEmail, isoDate, LIMITS, readRequestJson, text } from "@/lib/studio/request-json"

describe("text", () => {
  it("trims, caps, and drops anything that isn't a non-empty string", () => {
    expect(text("  Dan ")).toBe("Dan")
    expect(text("x".repeat(300))).toHaveLength(LIMITS.text)
    expect(text("x".repeat(300), 10)).toHaveLength(10)
    expect(text("   ")).toBeUndefined()
    expect(text(42)).toBeUndefined()
    expect(text(undefined)).toBeUndefined()
  })
})

describe("isEmail", () => {
  it("keeps one plain address and nothing that could steer a mailto: link", () => {
    expect(isEmail("a.b@firm.ca")).toBe("a.b@firm.ca")
    expect(isEmail(" A@B.C ")).toBe("A@B.C")
    expect(isEmail("x@y.com?bcc=evil@z.com")).toBeUndefined()
    expect(isEmail("x@y.com&body=hi")).toBeUndefined()
    expect(isEmail("not an email")).toBeUndefined()
    expect(isEmail("")).toBeUndefined()
    expect(isEmail(`${"a".repeat(300)}@b.c`)).toBeUndefined()
  })
})

describe("isoDate", () => {
  it("keeps a parseable timestamp as written and drops the rest", () => {
    expect(isoDate("2026-10-09T21:17:55.000Z")).toBe("2026-10-09T21:17:55.000Z")
    expect(isoDate("garbage")).toBeUndefined()
    expect(isoDate(1760000000000)).toBeUndefined()
    expect(isoDate(`2026-10-09T21:17:55.000Z${"0".repeat(40)}`)).toBeUndefined()
  })
})

describe("readRequestJson", () => {
  it("keeps only the fields the admin shows, as the right types", () => {
    const raw = {
      email: "a@b.c",
      name: "Dan",
      firm: 42,
      topicTitle: " Express Entry ",
      recordingSeconds: "61",
      checks: { faceSeen: true, voiceHeard: null },
      consent: { nope: true },
      consentAt: "2026-10-09T21:17:55.000Z",
      createdAt: ["x"],
      extra: "ignored",
    }
    expect(readRequestJson(raw)).toEqual({
      email: "a@b.c",
      name: "Dan",
      topicTitle: "Express Entry",
      recordingSeconds: 61,
      checks: { faceSeen: true, voiceHeard: null },
      consentAt: "2026-10-09T21:17:55.000Z",
    })
  })
  it("caps long text and survives a non-object", () => {
    expect(readRequestJson({ name: "x".repeat(300) }).name).toHaveLength(LIMITS.text)
    expect(readRequestJson({ topicTitle: "t".repeat(600) }).topicTitle).toHaveLength(LIMITS.topicTitle)
    expect(readRequestJson({ consent: "y".repeat(2001) }).consent).toHaveLength(LIMITS.consent)
    expect(readRequestJson(null)).toEqual({})
    expect(readRequestJson("str")).toEqual({})
    expect(readRequestJson([1, 2])).toEqual({})
  })
  it("drops a blank name, a steering email and an unparseable date", () => {
    expect(readRequestJson({ name: "   " }).name).toBeUndefined()
    expect(readRequestJson({ email: "x@y.com?bcc=evil@z.com" }).email).toBeUndefined()
    expect(readRequestJson({ consentAt: "yesterday", createdAt: "2026-10-09T00:00:00Z" })).toEqual({ createdAt: "2026-10-09T00:00:00Z" })
  })
  it("keeps only a positive, finite recording length, rounded", () => {
    expect(readRequestJson({ recordingSeconds: 61.6 }).recordingSeconds).toBe(62)
    expect(readRequestJson({ recordingSeconds: -5 }).recordingSeconds).toBeUndefined()
    expect(readRequestJson({ recordingSeconds: 0 }).recordingSeconds).toBeUndefined()
    expect(readRequestJson({ recordingSeconds: "abc" }).recordingSeconds).toBeUndefined()
    expect(readRequestJson({ recordingSeconds: Infinity }).recordingSeconds).toBeUndefined()
  })
})
