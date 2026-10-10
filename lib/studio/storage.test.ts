import { describe, expect, it } from "vitest"

import { buildMultipart, mediaUrl } from "@/lib/studio/storage"

describe("mediaUrl", () => {
  it("encodes the object name and carries the token", () => {
    expect(mediaUrl("studio/u1/s1/sample/speech.mp3", "abc")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/devdashboard-c9159-ca/o/studio%2Fu1%2Fs1%2Fsample%2Fspeech.mp3?alt=media&token=abc",
    )
  })
})

describe("buildMultipart", () => {
  it("writes the metadata part then the file part, Firebase SDK style", () => {
    const { contentType, body } = buildMultipart("studio/u/s/sample/a.json", '{"x":1}', "application/json", { k: "v" })
    const text = new TextDecoder().decode(body)
    const boundary = contentType.replace("multipart/related; boundary=", "")
    expect(boundary.length).toBeGreaterThan(8)
    expect(text.startsWith(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n`)).toBe(true)
    expect(text).toContain('"name":"studio/u/s/sample/a.json"')
    expect(text).toContain('"contentType":"application/json"')
    expect(text).toContain('"metadata":{"k":"v"}')
    expect(text).toContain(`\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n{"x":1}\r\n--${boundary}--`)
  })

  it("keeps binary bodies intact", () => {
    const bytes = new Uint8Array([0, 255, 10, 13, 128])
    const { body } = buildMultipart("f.bin", bytes, "application/octet-stream")
    const text = new TextDecoder("latin1").decode(body)
    const idx = text.indexOf("\r\n\r\n", text.indexOf("application/octet-stream")) + 4
    expect(Array.from(body.slice(idx, idx + 5))).toEqual([0, 255, 10, 13, 128])
  })
})
