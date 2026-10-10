import type { Card, Word } from "./types"

export type TimedCard = Card & { at: number; lineStart: number }

const digits = (s: string) => s.replace(/\D/g, "")

export function lineStart(line: number, words: Word[]): number | undefined {
  return words.find((w) => w.line === line)?.start
}

// When a card shows: on the word that says its number ("2,000", "$23,448",
// "2027"), like the landing samples, or at the start of its line when the
// number isn't spoken as one word (or there is none).
export function cardTime(card: Card, words: Word[]): number {
  const start = lineStart(card.line, words) ?? 0
  const numbers = (card.value.match(/\d[\d,]*/g) ?? []).map(digits).filter((n) => n.length >= 2)
  for (const wanted of [...numbers].reverse()) {
    const hit = words.find((w) => w.line === card.line && digits(w.word) === wanted)
    if (hit) return hit.start
  }
  return start
}

const MIN_SHOW = 1.5

// Cards that would land on the same instant (two on one line, neither on a
// spoken number) are spaced a second apart in script order. An overlay card
// whose number comes so late in its line that the next card would replace
// it within a moment starts with its line instead.
export function scheduleCards(cards: Card[], words: Word[]): TimedCard[] {
  const seen = new Map<number, number>()
  const byTime = (a: TimedCard, b: TimedCard) => a.at - b.at || a.line - b.line
  const timed = cards
    .map((c) => {
      const start = lineStart(c.line, words) ?? 0
      let at = cardTime(c, words)
      if (at === start) {
        const n = seen.get(c.line) ?? 0
        seen.set(c.line, n + 1)
        at = start + n
      }
      return { ...c, at, lineStart: start }
    })
    .sort(byTime)
  for (let i = 0; i < timed.length - 1; i++) {
    const c = timed[i]
    if (c.scene !== "takeover" && c.at > c.lineStart && timed[i + 1].at - c.at < MIN_SHOW) c.at = c.lineStart
  }
  return timed.sort(byTime)
}

/** A card stays this long unless another replaces it. */
export const CARD_SECONDS = 6

// The card in the top slot: the latest overlay card still within its time.
// Takeover cards live in their own scene, never in the slot.
export function topCard(timed: TimedCard[], t: number): TimedCard | null {
  const shown = timed.filter((c) => c.scene !== "takeover" && c.at <= t)
  const last = shown[shown.length - 1]
  return last && t < last.at + CARD_SECONDS ? last : null
}

export type Takeover = { start: number; end: number; cards: TimedCard[] }

// Consecutive takeover cards (on the same or adjacent lines) make one
// scene: from the start of the first card's line to the start of the line
// after the last card's, or the end of the video.
export function takeoverSegments(timed: TimedCard[], words: Word[], end: number): Takeover[] {
  const out: Takeover[] = []
  const takeover = timed.filter((c) => c.scene === "takeover").sort((a, b) => a.line - b.line || a.at - b.at)
  let group: TimedCard[] = []
  const flush = () => {
    if (!group.length) return
    const lastLine = group[group.length - 1].line
    const next = words.find((w) => w.line > lastLine)
    out.push({ start: group[0].lineStart, end: next ? next.start : end, cards: group })
    group = []
  }
  for (const c of takeover) {
    if (group.length && c.line > group[group.length - 1].line + 1) flush()
    group.push(c)
  }
  flush()
  return out
}
