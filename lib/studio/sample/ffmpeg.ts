import { execFile } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"
import { promisify } from "node:util"
import ffmpegPath from "ffmpeg-static"

const run = promisify(execFile)
const FFMPEG = ffmpegPath as string

// Everything here works on files in a fresh temp dir: Vercel functions give
// us a writable /tmp and nothing else.
export async function tmpDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "sample-"))
}

export async function downloadTo(response: Response, file: string): Promise<void> {
  if (!response.body) throw new Error("Empty download")
  await pipeline(Readable.fromWeb(response.body as NodeReadableStream), createWriteStream(file))
}

async function ffmpeg(args: string[]): Promise<string> {
  try {
    const { stderr } = await run(FFMPEG, ["-hide_banner", "-y", ...args], { maxBuffer: 16 * 1024 * 1024 })
    return stderr
  } catch (error) {
    const e = error as { stderr?: string; message: string }
    throw new Error(`ffmpeg failed: ${(e.stderr ?? e.message).split("\n").filter(Boolean).slice(-3).join(" | ")}`)
  }
}

// ffmpeg-static ships no ffprobe; "-i file" alone prints the duration.
export async function probeSeconds(file: string): Promise<number> {
  const stderr = await run(FFMPEG, ["-hide_banner", "-i", file]).then(
    (r) => r.stderr,
    (e: { stderr?: string }) => e.stderr ?? "",
  )
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr)
  if (!m) throw new Error("ffmpeg could not read the duration")
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

// A full recording is ~90 s: skip the head turn and first line (15 s) and
// keep a minute. Shorter files keep the same proportion.
// A minute of reading, skipping the first beat (settling in, the intro
// line starting). Recordings begin at the script now; older ones with the
// head turn at the start need the clip start moved by hand.
export function voiceWindow(duration: number): { start: number; seconds: number } {
  if (duration >= 62) return { start: 2, seconds: 60 }
  const start = Math.round(Math.min(2, duration * 0.15) * 10) / 10
  return { start, seconds: Math.round((duration - start) * 10) / 10 }
}

export function frameTimes(duration: number): number[] {
  return [0.3, 0.45, 0.6, 0.75, 0.9].map((f) => Math.min(Math.round(f * duration * 10) / 10, Math.max(0.1, duration - 0.5)))
}

export async function extractVoiceSample(input: string, out: string, duration: number): Promise<void> {
  const { start, seconds } = voiceWindow(duration)
  await ffmpeg(["-ss", String(start), "-t", String(seconds), "-i", input, "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", out])
}

export async function extractFrame(input: string, out: string, at: number): Promise<void> {
  await ffmpeg(["-ss", String(at), "-i", input, "-frames:v", "1", "-q:v", "2", out])
}

// Method A: the part of the recording that will carry the new speech. crop
// fits any aspect to 1080×1920 the way object-fit: cover would (a 16:9
// webcam clip keeps its middle column; a phone's 9:16 just scales).
export async function cutClip(input: string, out: string, opts: { start: number; seconds: number; crop: boolean }): Promise<void> {
  const filters = opts.crop ? ["-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"] : []
  await ffmpeg([
    "-ss", String(opts.start), "-t", String(opts.seconds), "-i", input,
    ...filters, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ])
}
