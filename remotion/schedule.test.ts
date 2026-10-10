import { describe, expect, it } from "vitest"

import { cardTime, scheduleCards, takeoverSegments, topCard } from "./schedule"
import type { Card, Word } from "./types"

// Four lines; line 1 mentions 2,000 and 518 part-way through.
const words: Word[] = [
  { word: "New", start: 0.2, end: 0.4, line: 0 },
  { word: "draw.", start: 0.5, end: 0.8, line: 0 },
  { word: "IRCC", start: 2.0, end: 2.3, line: 1 },
  { word: "invited", start: 2.4, end: 2.7, line: 1 },
  { word: "2,000", start: 2.8, end: 3.2, line: 1 },
  { word: "to", start: 3.3, end: 3.4, line: 1 },
  { word: "518.", start: 3.5, end: 3.9, line: 1 },
  { word: "Three", start: 6.0, end: 6.3, line: 2 },
  { word: "draws.", start: 6.4, end: 6.8, line: 2 },
  { word: "Follow", start: 9.0, end: 9.3, line: 3 },
]
const invitations: Card = { line: 1, label: "Invitations", value: "2,000", sub: null, scene: "takeover" }
const cutoff: Card = { line: 1, label: "CRS cut-off", value: "518", sub: null, scene: "takeover" }
const trend: Card = { line: 2, label: "3 draws down", value: "518", sub: "521 → 519 → 518" }
const note: Card = { line: 3, label: "Score close?", value: "Keep your profile up to date", sub: null, kind: "note" }

describe("cardTime", () => {
  it("pops a takeover card on the word that says its number", () => {
    expect(cardTime(invitations, words)).toBe(2.8)
    expect(cardTime(cutoff, words)).toBe(3.5)
  })
  it("starts an overlay card with its line", () => {
    expect(cardTime(trend, words)).toBe(6.0)
    expect(cardTime(note, words)).toBe(9.0)
  })
  it("falls back to the line start when the number isn't spoken as a word", () => {
    expect(cardTime({ ...invitations, value: "9,999" }, words)).toBe(2.0)
  })
})

describe("scheduleCards and topCard", () => {
  const timed = scheduleCards([trend, invitations, note, cutoff], words)
  it("sorts by time and remembers each card's line start", () => {
    expect(timed.map((c) => [c.label, c.at, c.lineStart])).toEqual([
      ["Invitations", 2.8, 2.0],
      ["CRS cut-off", 3.5, 2.0],
      ["3 draws down", 6.0, 6.0],
      ["Score close?", 9.0, 9.0],
    ])
  })
  it("starts an overlay card with its line when its number comes just before the next card", () => {
    // "518." is the last word of line 1 at 3.5; a card on line 2 follows at 6.0 — fine, 2.5 s apart.
    const late: Card = { line: 1, label: "Cut-off", value: "518", sub: null }
    expect(scheduleCards([late, trend], words)[0].at).toBe(3.5)
    // But with the next card only 0.5 s later, the late card moves to its line start.
    const soon: Card = { line: 2, label: "Soon", value: "x", sub: null }
    const words2 = words.map((w) => (w.line === 2 ? { ...w, start: w.start - 2, end: w.end - 2 } : w))
    expect(scheduleCards([late, soon], words2).map((c) => [c.label, c.at])).toEqual([
      ["Cut-off", 2.0],
      ["Soon", 4.0],
    ])
  })
  it("shows the latest overlay card in the top slot, never a takeover card", () => {
    expect(topCard(timed, 1)).toBeNull()
    expect(topCard(timed, 4)).toBeNull()
    expect(topCard(timed, 7)?.label).toBe("3 draws down")
    expect(topCard(timed, 12)?.label).toBe("Score close?")
  })
})

describe("takeoverSegments", () => {
  it("runs from the first takeover card's line to the start of the next line after the last one", () => {
    const timed = scheduleCards([invitations, cutoff, trend], words)
    expect(takeoverSegments(timed, words, 20)).toEqual([{ start: 2.0, end: 6.0, cards: [timed[0], timed[1]] }])
  })
  it("ends at the video end when nothing follows, and is empty without takeover cards", () => {
    const last = scheduleCards([{ ...invitations, line: 3, value: "x" }], words)
    expect(takeoverSegments(last, words, 20)).toEqual([{ start: 9.0, end: 20, cards: last }])
    expect(takeoverSegments(scheduleCards([trend], words), words, 20)).toEqual([])
  })
})
