import { describe, expect, it } from "vitest"

import { asEmail, identifier, isoDate, LIMITS, readRequestJson, seconds, text } from "@/lib/studio/request-json"

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

describe("identifier", () => {
  it("takes an id exactly as sent or not at all: a cut or trimmed id is a different id", () => {
    expect(identifier("20261009T211755-393dbaa7", LIMITS.submissionId)).toBe("20261009T211755-393dbaa7")
    expect(identifier("x".repeat(65), LIMITS.submissionId)).toBeUndefined()
    // Not trimmed either: the route's own shape check decides on the spaces.
    expect(identifier(" padded ", 64)).toBe(" padded ")
    expect(identifier("", 64)).toBeUndefined()
    expect(identifier(12, 64)).toBeUndefined()
  })
})

describe("asEmail", () => {
  it("keeps one plain address and nothing that could steer a mailto: link", () => {
    expect(asEmail("a.b@firm.ca")).toBe("a.b@firm.ca")
    expect(asEmail(" A@B.C ")).toBe("A@B.C")
    expect(asEmail("x@y.com?bcc=evil@z.com")).toBeUndefined()
    expect(asEmail("x@y.com&body=hi")).toBeUndefined()
    expect(asEmail("a@b.c%3Fbcc=x%40y.z")).toBeUndefined()
    expect(asEmail("a@b.c,c@d.e")).toBeUndefined()
    expect(asEmail("a@b.c;c@d.e")).toBeUndefined()
    expect(asEmail("a@b.c#x")).toBeUndefined()
    expect(asEmail("not an email")).toBeUndefined()
    expect(asEmail("")).toBeUndefined()
    expect(asEmail(`${"a".repeat(300)}@b.c`)).toBeUndefined()
  })
})

describe("isoDate", () => {
  it("normalises any parseable timestamp to ISO, so the list sorts by time, not by spelling", () => {
    expect(isoDate("2026-10-09T21:17:55.000Z")).toBe("2026-10-09T21:17:55.000Z")
    expect(isoDate("2026-10-09T14:17:55-07:00")).toBe("2026-10-09T21:17:55.000Z")
    expect(isoDate("Oct 9 2026 21:17:55 GMT")).toBe("2026-10-09T21:17:55.000Z")
    expect(isoDate("garbage")).toBeUndefined()
    expect(isoDate(1760000000000)).toBeUndefined()
    expect(isoDate(`2026-10-09T21:17:55.000Z${"0".repeat(40)}`)).toBeUndefined()
  })
})

describe("seconds", () => {
  it("keeps only a positive, finite length within a day, rounded", () => {
    expect(seconds(61.6)).toBe(62)
    expect(seconds("61")).toBe(61)
    expect(seconds(-5)).toBeUndefined()
    expect(seconds(0)).toBeUndefined()
    expect(seconds("abc")).toBeUndefined()
    expect(seconds(Infinity)).toBeUndefined()
    expect(seconds(1e15)).toBeUndefined()
  })
  it("reads only a number or a decimal string, not whatever Number() would coerce", () => {
    expect(seconds(true)).toBeUndefined()
    expect(seconds([61])).toBeUndefined()
    expect(seconds("0x10")).toBeUndefined()
    expect(seconds(null)).toBeUndefined()
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
    expect(readRequestJson({ consentAt: "yesterday", createdAt: "2026-10-09T00:00:00Z" })).toEqual({ createdAt: "2026-10-09T00:00:00.000Z" })
  })
  it("keeps only a positive, finite recording length, rounded", () => {
    expect(readRequestJson({ recordingSeconds: 61.6 }).recordingSeconds).toBe(62)
    expect(readRequestJson({ recordingSeconds: -5 }).recordingSeconds).toBeUndefined()
    expect(readRequestJson({ recordingSeconds: 0 }).recordingSeconds).toBeUndefined()
    expect(readRequestJson({ recordingSeconds: "abc" }).recordingSeconds).toBeUndefined()
    expect(readRequestJson({ recordingSeconds: Infinity }).recordingSeconds).toBeUndefined()
  })
})
