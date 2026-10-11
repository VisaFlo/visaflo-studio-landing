import { describe, expect, it } from "vitest"

import { downloadName, parseSubmissionId } from "@/lib/studio/submissions"

describe("parseSubmissionId", () => {
  it("accepts uid/submissionId", () => {
    expect(parseSubmissionId("abcDEF123/20261009T120000-1a2b3c4d")).toEqual({ uid: "abcDEF123", submissionId: "20261009T120000-1a2b3c4d" })
  })
  it("rejects anything that could escape the folder", () => {
    for (const bad of ["", "a", "a/b/c", "../x/y", "a/..", "a b/c", 42, null, "a/b%2F"]) {
      expect(parseSubmissionId(bad)).toBeNull()
    }
  })
})

describe("downloadName", () => {
  it("names the file after the person and the submission, with the recording's extension", () => {
    expect(downloadName({ name: "Dan Jeong", submissionId: "20261009T211755-393dbaa7" }, "studio/u/s/recording.mp4")).toBe(
      "dan-jeong-20261009T211755-393dbaa7.mp4",
    )
  })
  it("falls back to the email, then the uid, and strips anything odd", () => {
    expect(downloadName({ email: "a.b@firm.ca", uid: "U1", submissionId: "S1" }, "studio/U1/S1/recording.webm")).toBe("a-b-firm-ca-S1.webm")
    expect(downloadName({ uid: "Mi0wDogz", submissionId: "S1" }, "x/recording.mp4")).toBe("Mi0wDogz-S1.mp4")
    expect(downloadName({ name: "  ", uid: "u", submissionId: "s" }, "x/recording")).toBe("u-s.mp4")
  })
})
