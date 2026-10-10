import { describe, expect, it } from "vitest"

import { scheduleCards, visibleCards } from "./cards-schedule"

const words = [
  { word: "a", start: 0.2, end: 0.5, line: 0 },
  { word: "b", start: 4, end: 4.3, line: 1 },
  { word: "c", start: 9, end: 9.3, line: 2 },
  { word: "d", start: 14, end: 14.3, line: 3 },
]
const cards = [
  { line: 0, label: "A", value: "1", sub: null },
  { line: 1, label: "B", value: "2", sub: null },
  { line: 2, label: "C", value: "3", sub: null },
  { line: 3, label: "D", value: "4", sub: null },
]

describe("scheduleCards", () => {
  it("times each card to its line's first word and keeps them all", () => {
    const timed = scheduleCards(cards, words, 0)
    expect(timed.map((c) => [c.label, c.at])).toEqual([
      ["A", 0.2],
      ["B", 4],
      ["C", 9],
      ["D", 14],
    ])
  })
  it("holds a card until the headline has faded", () => {
    const timed = scheduleCards(cards, words, 2.5)
    expect(timed[0].at).toBe(2.5)
    expect(timed[1].at).toBe(4)
  })
})

describe("visibleCards", () => {
  it("shows at most the two most recent cards, newest last", () => {
    const timed = scheduleCards(cards, words, 0)
    expect(visibleCards(timed, 3).map((c) => c.label)).toEqual(["A"])
    expect(visibleCards(timed, 10).map((c) => c.label)).toEqual(["B", "C"])
    expect(visibleCards(timed, 20).map((c) => c.label)).toEqual(["C", "D"])
  })
})
