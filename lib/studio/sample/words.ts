import { stripTags, type ScriptLine } from "@/lib/studio/sample/script"

export type Alignment = {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export type Word = { word: string; start: number; end: number; line: number }

type Token = { text: string; start: number; end: number }

function tokens(alignment: Alignment): Token[] {
  const out: Token[] = []
  let current: Token | null = null
  alignment.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) out.push(current)
      current = null
      return
    }
    const start = alignment.character_start_times_seconds[i]
    const end = alignment.character_end_times_seconds[i]
    if (current) {
      current.text += ch
      current.end = end
    } else current = { text: ch, start, end }
  })
  if (current) out.push(current)
  // Delivery tags like [confident] are spoken as nothing; drop them.
  return out.filter((t) => !/^\[[^\]]*\]$/.test(t.text))
}

// Caption words with the times ElevenLabs gave the spoken words. The TTS text
// and caption text differ only by tags, "I-R-C-C" and digits, so most lines map
// one to one; when they don't, caption words share the line's time evenly.
export function wordsFromAlignment(alignment: Alignment, lines: ScriptLine[]): Word[] {
  const all = tokens(alignment)
  const out: Word[] = []
  let cursor = 0
  lines.forEach((line, lineIndex) => {
    const spoken = stripTags(line.tts_text).split(/\s+/).filter(Boolean)
    const captions = line.caption_text.trim().split(/\s+/).filter(Boolean)
    const mine = all.slice(cursor, cursor + spoken.length)
    cursor += spoken.length
    const fallbackStart = mine[0]?.start ?? out[out.length - 1]?.end ?? 0
    const fallbackEnd = mine[mine.length - 1]?.end ?? fallbackStart + 0.4 * captions.length
    if (mine.length === captions.length && mine.length > 0) {
      captions.forEach((word, i) => out.push({ word, start: mine[i].start, end: mine[i].end, line: lineIndex }))
      return
    }
    const span = Math.max(fallbackEnd - fallbackStart, 0.1)
    captions.forEach((word, i) => {
      const a = fallbackStart + (span * i) / captions.length
      const b = fallbackStart + (span * (i + 1)) / captions.length
      out.push({ word, start: a, end: b, line: lineIndex })
    })
  })
  return out
}
