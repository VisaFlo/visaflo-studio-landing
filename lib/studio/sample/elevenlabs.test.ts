import { afterEach, describe, expect, it, vi } from "vitest"

import { composeMusic, soundEffect, synthesize, TTS_MODELS } from "@/lib/studio/sample/elevenlabs"

const b64 = Buffer.from([1, 2, 3]).toString("base64")
const alignment = { characters: ["h", "i"], character_start_times_seconds: [0, 0.1], character_end_times_seconds: [0.1, 0.2] }

afterEach(() => vi.unstubAllGlobals())

describe("synthesize", () => {
  it("sends the v4 request with our voice settings and decodes the audio", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audio_base64: b64, alignment }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const r = await synthesize("v1", "hi")
    expect(Array.from(r.audio)).toEqual([1, 2, 3])
    expect(r.modelId).toBe("eleven_v4")
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/v1/with-timestamps?output_format=mp3_44100_128")
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("k")
    const body = JSON.parse(init.body as string)
    expect(body.model_id).toBe("eleven_v4")
    expect(body.voice_settings).toEqual({ stability: 0.5, similarity_boost: 0.8, style: 0.2, speed: 1.05, use_speaker_boost: true })
    expect(body.apply_text_normalization).toBe("on")
  })

  it("falls back to the next model when one rejects the model id", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    let calls = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++
        if (calls === 1) return new Response(JSON.stringify({ detail: { status: "model_not_found" } }), { status: 400 })
        return new Response(JSON.stringify({ audio_base64: b64, alignment }), { status: 200 })
      }),
    )
    const r = await synthesize("v1", "hi")
    expect(r.modelId).toBe(TTS_MODELS[1])
  })

  it("surfaces other errors", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 402 })))
    await expect(synthesize("v1", "hi")).rejects.toThrow(/402/)
  })
})

describe("music and sfx", () => {
  it("asks for instrumental music of the right length", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([9]), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    expect(Array.from(await composeMusic("p", 28_000))).toEqual([9])
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128")
    expect(JSON.parse(init.body as string)).toEqual({ prompt: "p", music_length_ms: 28000, force_instrumental: true, model_id: "music_v2_5" })
  })
  it("asks for a short sound effect", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([7]), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await soundEffect("whoosh", 0.7)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ text: "whoosh", duration_seconds: 0.7, prompt_influence: 0.6, model_id: "eleven_text_to_sound_v2" })
  })
})
