import type { Card, Word } from "./types"

export type TimedCard = Card & { at: number }

// A card appears on the first word of its line, but never under the headline.
export function scheduleCards(cards: Card[], words: Word[], headlineSeconds: number): TimedCard[] {
  return cards
    .map((c) => ({ ...c, at: Math.max(words.find((w) => w.line === c.line)?.start ?? 0, headlineSeconds) }))
    .sort((a, b) => a.at - b.at)
}

// Only the two most recent cards stay on screen, so the band above the face
// never grows into it.
export function visibleCards(timed: TimedCard[], t: number): TimedCard[] {
  return timed.filter((c) => t >= c.at).slice(-2)
}
