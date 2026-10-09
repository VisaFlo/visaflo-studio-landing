// Follows a reader through the script word by word, karaoke style, from
// speech-recognition transcripts. Recognition is noisy (missed words, "its"
// for "it's", "3" for "three", acronyms spelled out), so the matcher looks a
// few words ahead and accepts near misses instead of insisting on every word.

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  first: "1st", second: "2nd", third: "3rd",
}

export function normalizeWord(word: string): string {
  const w = word.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "")
  return NUMBER_WORDS[w] ?? w
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean)
}

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export function wordsMatch(heard: string, expected: string): boolean {
  if (!heard || !expected) return false
  if (heard === expected) return true
  // Short words ("you" vs "your") must match exactly; longer ones may be one
  // letter off ("lopes" for "lopez", "irc" for "ircc" counts via prefix).
  if (expected.length >= 5 && editDistanceAtMost1(heard, expected)) return true
  if (expected.length >= 4 && heard.length >= 3 && expected.startsWith(heard)) return true
  return false
}

// Skipping ahead needs stronger evidence than matching the next word: an
// exact hit on a word long enough not to be filler.
function strongMatch(heard: string, expected: string): boolean {
  return heard.length >= 4 && wordsMatch(heard, expected)
}

const LOOKAHEAD = 4

/**
 * Moves `pointer` (index of the next script word to be read) forward over the
 * heard words. Each heard word may match the expected word or one up to
 * LOOKAHEAD words later (the reader or the recognizer skipped some).
 */
export function advancePointer(script: string[], pointer: number, heard: string[]): number {
  let p = pointer
  for (const word of heard) {
    for (let k = 0; k <= LOOKAHEAD && p + k < script.length; k++) {
      if (k === 0 ? wordsMatch(word, script[p]) : strongMatch(word, script[p + k])) {
        p = p + k + 1
        break
      }
    }
  }
  return p
}

export type ScriptIndex = {
  words: string[]
  /** Index of each line's first word in `words`. */
  lineStarts: number[]
}

export function indexScript(lines: string[]): ScriptIndex {
  const words: string[] = []
  const lineStarts: number[] = []
  for (const line of lines) {
    lineStarts.push(words.length)
    words.push(...tokenize(line))
  }
  return { words, lineStarts }
}

export function lineOfWord(index: ScriptIndex, pointer: number): number {
  let line = 0
  for (let i = 0; i < index.lineStarts.length; i++) if (index.lineStarts[i] <= pointer) line = i
  return line
}
