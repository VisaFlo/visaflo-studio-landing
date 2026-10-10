import { afterEach, describe, expect, it, vi } from "vitest"

import { LIPSYNC_MODELS, pollFal, submitFal } from "@/lib/studio/sample/fal"
import { pollHiggsfield, submitSeedance } from "@/lib/studio/sample/higgsfield"

afterEach(() => vi.unstubAllGlobals())

describe("fal", () => {
  it("names both lipsync models", () => {
    expect(LIPSYNC_MODELS.standard).toBe("fal-ai/sync-lipsync/v2")
    expect(LIPSYNC_MODELS.pro).toBe("fal-ai/sync-lipsync/v2/pro")
  })

  it("submits to the queue and keeps the status and response urls", async () => {
    process.env.FAL_KEY = "fk"
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ request_id: "r1", status_url: "https://q/s", response_url: "https://q/r" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const job = await submitFal(LIPSYNC_MODELS.pro, { video_url: "v", audio_url: "a", sync_mode: "cut_off" })
    expect(job).toEqual({ provider: "fal", id: "r1", statusUrl: "https://q/s", responseUrl: "https://q/r" })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://queue.fal.run/fal-ai/sync-lipsync/v2/pro")
    expect((init.headers as Record<string, string>).Authorization).toBe("Key fk")
    expect(JSON.parse(init.body as string)).toEqual({ video_url: "v", audio_url: "a", sync_mode: "cut_off" })
  })

  it("polls: in progress, completed with video url, failed", async () => {
    process.env.FAL_KEY = "fk"
    const job = { provider: "fal" as const, id: "r1", statusUrl: "https://q/s", responseUrl: "https://q/r" }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "IN_PROGRESS" }))))
    expect(await pollFal(job)).toEqual({ state: "running" })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "https://q/s"
          ? new Response(JSON.stringify({ status: "COMPLETED" }))
          : new Response(JSON.stringify({ video: { url: "https://out/v.mp4" } })),
      ),
    )
    expect(await pollFal(job)).toEqual({ state: "done", videoUrl: "https://out/v.mp4" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "FAILED", error: "bad audio" }), { status: 200 })))
    expect(await pollFal(job)).toMatchObject({ state: "failed" })
  })
})

describe("higgsfield", () => {
  it("submits Seedance 2.5 with our fixed settings", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id"
    process.env.HIGGSFIELD_KEY_SECRET = "sec"
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ request_id: "h1", status_url: "https://h/s", cancel_url: "https://h/c" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const job = await submitSeedance({ imageUrl: "i", audioUrl: "a", prompt: "p", duration: 27 })
    expect(job).toEqual({ provider: "higgsfield", id: "h1", statusUrl: "https://h/s", step: "scene" })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.higgsfield.ai/bytedance/seedance-2.5/reference-to-video")
    expect((init.headers as Record<string, string>).Authorization).toBe("Key id:sec")
    expect(JSON.parse(init.body as string)).toEqual({
      prompt: "p",
      image_urls: ["i"],
      audio_urls: ["a"],
      duration: 27,
      resolution: "720p",
      aspect_ratio: "9:16",
      bitrate_mode: "standard",
      generate_audio: true,
    })
  })

  it("polls Higgsfield statuses", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id"
    process.env.HIGGSFIELD_KEY_SECRET = "sec"
    const job = { provider: "higgsfield" as const, id: "h1", statusUrl: "https://h/s", step: "scene" as const }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "in_progress" }))))
    expect(await pollHiggsfield(job)).toEqual({ state: "running" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "completed", video: { url: "https://h/v.mp4" } }))))
    expect(await pollHiggsfield(job)).toEqual({ state: "done", videoUrl: "https://h/v.mp4" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "failed", error: "nsfw" }))))
    expect(await pollHiggsfield(job)).toMatchObject({ state: "failed" })
  })
})
