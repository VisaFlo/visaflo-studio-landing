import type { Word } from "./types"

export type Group = { start: number; end: number; words: Word[] }

// Karaoke groups: a few words at a time, never across a script line, and a
// new group after a pause so the caption doesn't sit there during silence.
export function groupWords(words: Word[], maxWords = 4, maxGap = 0.8): Group[] {
  const groups: Group[] = []
  let current: Word[] = []
  const flush = () => {
    if (current.length) groups.push({ start: current[0].start, end: current[current.length - 1].end, words: current })
    current = []
  }
  words.forEach((word, i) => {
    const prev = words[i - 1]
    if (prev && (current.length >= maxWords || word.line !== prev.line || word.start - prev.end > maxGap)) flush()
    current.push(word)
  })
  flush()
  // A group stays on screen until the next one starts.
  for (let i = 0; i < groups.length - 1; i++) groups[i].end = groups[i + 1].start
  return groups
}
