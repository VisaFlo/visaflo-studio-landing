import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import ffmpegPath from "ffmpeg-static"
import { beforeAll, describe, expect, it } from "vitest"

import { cutClip, extractFrame, extractVoiceSample, frameTimes, probeSeconds, tmpDir, voiceWindow } from "@/lib/studio/sample/ffmpeg"

const run = promisify(execFile)
let dir: string
let input: string

beforeAll(async () => {
  dir = await tmpDir()
  input = path.join(dir, "in.mp4")
  // 8 s of test pattern + tone: shorter than the 75 s a full recording has.
  await run(ffmpegPath as string, [
    "-y", "-f", "lavfi", "-i", "testsrc=duration=8:size=640x360:rate=10",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
    "-shortest", "-pix_fmt", "yuv420p", input,
  ])
}, 60_000)

describe("windows", () => {
  it("skips the first beat of a full recording and keeps a minute", () => {
    expect(voiceWindow(90)).toEqual({ start: 2, seconds: 60 })
  })
  it("clamps to a short recording", () => {
    expect(voiceWindow(8)).toEqual({ start: 1.2, seconds: 6.8 })
    expect(frameTimes(8).every((t) => t > 0 && t <= 7.5)).toBe(true)
    expect(frameTimes(8)).toHaveLength(5)
  })
})

describe("ffmpeg", () => {
  it("probes duration", async () => {
    expect(await probeSeconds(input)).toBeCloseTo(8, 0)
  })
  it("extracts a non-empty voice sample from a short file", async () => {
    const out = path.join(dir, "voice.wav")
    await extractVoiceSample(input, out, 8)
    expect((await stat(out)).size).toBeGreaterThan(100_000)
    expect(await probeSeconds(out)).toBeCloseTo(6.8, 0)
  })
  it("extracts a frame", async () => {
    const out = path.join(dir, "f.jpg")
    await extractFrame(input, out, 7.2)
    expect((await stat(out)).size).toBeGreaterThan(1000)
  })
  it("cuts and crops a clip to 9:16", async () => {
    const out = path.join(dir, "clip.mp4")
    await cutClip(input, out, { start: 2, seconds: 3, crop: true })
    expect(await probeSeconds(out)).toBeCloseTo(3, 0)
    const { stderr } = await run(ffmpegPath as string, ["-i", out]).catch((e) => e as { stderr: string })
    expect(stderr).toMatch(/ 1080x1920/)
  })
}, 60_000)
