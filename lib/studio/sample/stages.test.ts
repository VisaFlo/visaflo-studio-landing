import { afterEach, describe, expect, it, vi } from "vitest"

import * as context from "@/lib/studio/sample/context"
import * as elevenlabs from "@/lib/studio/sample/elevenlabs"
import { STAGE_WORK } from "@/lib/studio/sample/stages"
import { defaultStatus, startStage } from "@/lib/studio/sample/status"
import * as storage from "@/lib/studio/storage"

const ref = { uid: "u", submissionId: "s", folder: "studio/u/s", sampleFolder: "studio/u/s/sample" }
const script = {
  draft: {
    headline: "H",
    published: "2026-10-09",
    lines: Array.from({ length: 12 }, () => ({ tts_text: "word word word word word word", caption_text: "word word word word word word" })),
    cards: [],
    sources: [{ url: "https://www.canada.ca/x", title: "x" }],
    facts: [],
    estimated_seconds: 40,
  },
  approved: true,
  model: "template:x",
  createdAt: "2026-10-09T00:00:00Z",
  searchSources: [],
}

afterEach(() => vi.restoreAllMocks())

describe("voice stage", () => {
  it("keeps the new voice id even when the speech is too long and the stage fails", async () => {
    vi.spyOn(storage, "storageJson").mockResolvedValue(script)
    vi.spyOn(storage, "storageBytes").mockResolvedValue(new Uint8Array([1]))
    vi.spyOn(elevenlabs, "createVoice").mockResolvedValue("voice-1")
    // 40 s of speech: one character per 0.5 s over 80 characters.
    const text = script.draft.lines.map((l) => l.tts_text).join("\n\n")
    const characters = Array.from(text)
    vi.spyOn(elevenlabs, "synthesize").mockResolvedValue({
      audio: new Uint8Array([1]),
      modelId: "eleven_v4",
      alignment: {
        characters,
        character_start_times_seconds: characters.map((_, i) => (i * 40) / characters.length),
        character_end_times_seconds: characters.map((_, i) => ((i + 1) * 40) / characters.length),
      },
    })
    const writes = vi.spyOn(context, "writeStatus").mockResolvedValue()

    const status = startStage({ ...defaultStatus(), scriptApproved: true }, "voice")
    await expect(STAGE_WORK.voice!({ token: "t", ref, status, body: {} })).rejects.toThrow(/under 30s/)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(writes.mock.calls[0][2].voiceId).toBe("voice-1")
  })
})
