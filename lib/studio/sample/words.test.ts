import { describe, expect, it } from "vitest"

import { wordsFromAlignment, type Alignment } from "@/lib/studio/sample/words"

// Builds an alignment where every character takes 0.1 s.
function align(text: string): Alignment {
  const characters = Array.from(text)
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * 0.1),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.1),
  }
}

describe("wordsFromAlignment", () => {
  it("maps words to caption text and lines when counts match", () => {
    const lines = [
      { tts_text: "[confident] I-R-C-C ran a draw.", caption_text: "IRCC ran a draw." },
      { tts_text: "Score was high.", caption_text: "Score was high." },
    ]
    const words = wordsFromAlignment(align("[confident] I-R-C-C ran a draw.\n\nScore was high."), lines)
    expect(words.map((w) => w.word)).toEqual(["IRCC", "ran", "a", "draw.", "Score", "was", "high."])
    expect(words.map((w) => w.line)).toEqual([0, 0, 0, 0, 1, 1, 1])
    // "[confident] " is 12 chars → I-R-C-C starts at 1.2 s
    expect(words[0].start).toBeCloseTo(1.2, 5)
    expect(words[0].end).toBeCloseTo(1.9, 5)
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].end - 1e-9)
  })

  it("spreads caption words over the line's time when counts differ", () => {
    const lines = [{ tts_text: "twenty five percent", caption_text: "25%" }, { tts_text: "ok", caption_text: "ok" }]
    const words = wordsFromAlignment(align("twenty five percent\n\nok"), lines)
    expect(words.map((w) => w.word)).toEqual(["25%", "ok"])
    expect(words[0].start).toBeCloseTo(0, 5)
    expect(words[0].end).toBeCloseTo(1.9, 5) // end of "percent"
    expect(words[1].line).toBe(1)
  })

  it("survives a tts line with more words than the alignment has left", () => {
    const lines = [{ tts_text: "a b c d", caption_text: "a b c d" }]
    const words = wordsFromAlignment(align("a b"), lines)
    expect(words).toHaveLength(4)
    expect(words.every((w) => Number.isFinite(w.start) && Number.isFinite(w.end))).toBe(true)
  })
})
