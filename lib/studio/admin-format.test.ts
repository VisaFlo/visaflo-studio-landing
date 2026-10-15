import { describe, expect, it } from "vitest"

import { clipLength, describeProblems, fileInfo, megabytes, topicFallback, when } from "@/lib/studio/admin-format"

describe("admin formatters", () => {
  it("shows a dash for missing or unreadable times and lengths", () => {
    expect(when(undefined)).toBe("—")
    expect(when("garbage")).toBe("—")
    expect(clipLength(undefined)).toBe("—")
    expect(clipLength(0)).toBe("—")
  })
  it("shows times in Vancouver", () => {
    expect(when("2026-10-09T21:17:55.000Z")).toMatch(/Oct 9, 2026.*2:17/)
  })
  it("describes the file only from what the metadata really said", () => {
    expect(fileInfo({ name: "r", contentType: "video/mp4", bytes: 51604544 })).toBe("video/mp4, 49.2 MB")
    expect(fileInfo({ name: "r", bytes: 1048576 })).toBe("1.0 MB")
    expect(fileInfo({ name: "r" })).toBe("—")
    expect(fileInfo(undefined)).toBe("—")
  })
  it("formats lengths as m:ss, rounding once", () => {
    expect(clipLength(90)).toBe("1:30")
    expect(clipLength(59.6)).toBe("1:00")
    expect(clipLength(5)).toBe("0:05")
  })
  it("formats sizes in megabytes", () => {
    expect(megabytes(51604544)).toBe("49.2 MB")
  })
  it("tells an unread request.json from a topic not picked yet", () => {
    expect(topicFallback("request-unreadable")).toBe("Couldn't read request.json")
    expect(topicFallback("recorded")).toBe("No topic picked yet")
    expect(topicFallback("requested")).toBe("No topic picked yet")
  })
})

describe("describeProblems", () => {
  it("writes one line the admin can act on", () => {
    expect(describeProblems([{ kind: "no-recording" }, { kind: "request-unreadable", detail: "Storage responded 500: x" }])).toBe(
      "No recording file in this folder; request.json couldn't be read (Storage responded 500: x)",
    )
    expect(describeProblems([{ kind: "no-token" }])).toBe("The recording has no download token, so it can't play here; use Download video")
    expect(describeProblems([])).toBe("")
  })
})
