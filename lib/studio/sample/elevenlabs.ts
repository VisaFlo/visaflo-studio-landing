import type { Alignment } from "@/lib/studio/sample/words"

const BASE = "https://api.elevenlabs.io/v1"

export function elevenHeaders(): Record<string, string> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set")
  return { "xi-api-key": key }
}

async function fail(response: Response, what: string): Promise<never> {
  throw new Error(`ElevenLabs ${what} responded ${response.status}: ${(await response.text()).slice(0, 300)}`)
}

// Instant Voice Clone from the minute of reading we extracted; one per person.
export async function createVoice(opts: { name: string; description: string; sample: Uint8Array; filename: string }): Promise<string> {
  const form = new FormData()
  form.set("name", opts.name)
  form.set("description", opts.description)
  form.set("remove_background_noise", "true")
  form.set("labels", JSON.stringify({ use_case: "news" }))
  form.append("files", new Blob([opts.sample as BlobPart], { type: "audio/wav" }), opts.filename)
  const response = await fetch(`${BASE}/voices/add`, { method: "POST", headers: elevenHeaders(), body: form })
  if (!response.ok) return fail(response, "voice clone")
  const body = (await response.json()) as { voice_id: string }
  return body.voice_id
}

export const TTS_MODELS = ["eleven_v4", "eleven_v3", "eleven_multilingual_v2"]

const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.2, speed: 1.05, use_speaker_boost: true }

// Newest model first; an account or endpoint that lacks it says so with a
// 4xx naming the model, and we step down.
export async function synthesize(voiceId: string, text: string): Promise<{ audio: Uint8Array; alignment: Alignment; modelId: string }> {
  let lastError: Error | null = null
  for (const modelId of TTS_MODELS) {
    const response = await fetch(`${BASE}/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { ...elevenHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: modelId, voice_settings: VOICE_SETTINGS, apply_text_normalization: "on" }),
    })
    if (response.ok) {
      const body = (await response.json()) as { audio_base64: string; alignment: Alignment | null; normalized_alignment: Alignment | null }
      const alignment = body.alignment ?? body.normalized_alignment
      if (!alignment) throw new Error("ElevenLabs returned no alignment")
      return { audio: new Uint8Array(Buffer.from(body.audio_base64, "base64")), alignment, modelId }
    }
    const detail = await response.text()
    if (response.status >= 400 && response.status < 500 && /model/i.test(detail)) {
      lastError = new Error(`ElevenLabs rejected ${modelId}: ${detail.slice(0, 200)}`)
      continue
    }
    throw new Error(`ElevenLabs text-to-speech responded ${response.status}: ${detail.slice(0, 300)}`)
  }
  throw lastError ?? new Error("No ElevenLabs model accepted the request")
}

export async function composeMusic(prompt: string, lengthMs: number): Promise<Uint8Array> {
  const response = await fetch(`${BASE}/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { ...elevenHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, music_length_ms: Math.round(lengthMs), force_instrumental: true, model_id: "music_v2_5" }),
  })
  if (!response.ok) return fail(response, "music")
  return new Uint8Array(await response.arrayBuffer())
}

export async function soundEffect(text: string, durationSeconds: number): Promise<Uint8Array> {
  const response = await fetch(`${BASE}/sound-generation?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { ...elevenHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: durationSeconds, prompt_influence: 0.6, model_id: "eleven_text_to_sound_v2" }),
  })
  if (!response.ok) return fail(response, "sound effect")
  return new Uint8Array(await response.arrayBuffer())
}
