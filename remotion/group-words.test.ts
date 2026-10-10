import { describe, expect, it } from "vitest"

import { groupWords, splitLines } from "./group-words"

const w = (word: string, start: number, line = 0) => ({ word, start, end: start + 0.3, line })

describe("groupWords", () => {
  it("makes groups of up to six words", () => {
    const words = ["a", "b", "c", "d", "e", "f", "g", "h"].map((t, i) => w(t, i * 0.4))
    const groups = groupWords(words)
    expect(groups.map((g) => g.words.map((x) => x.word))).toEqual([["a", "b", "c", "d", "e", "f"], ["g", "h"]])
    expect(groups[0].start).toBe(0)
    expect(groups[0].end).toBe(groups[1].start)
    expect(groups[1].end).toBeCloseTo(2.8 + 0.3)
  })
  it("breaks at line boundaries and long pauses", () => {
    const words = [w("a", 0), w("b", 0.4), w("c", 0.8, 1), w("d", 1.2, 1), w("e", 3.0, 1)]
    const groups = groupWords(words)
    expect(groups.map((g) => g.words.map((x) => x.word))).toEqual([["a", "b"], ["c", "d"], ["e"]])
  })
  it("returns nothing for no words", () => {
    expect(groupWords([])).toEqual([])
  })
})

describe("splitLines", () => {
  it("keeps up to three words on one line", () => {
    const words = ["Heads", "up."].map((t, i) => w(t, i))
    expect(splitLines(words).map((l) => l.map((x) => x.word))).toEqual([["Heads", "up."]])
  })
  it("breaks longer groups into two lines of about the same width", () => {
    const words = ["Canada", "has", "paused", "new", "applications", "under"].map((t, i) => w(t, i))
    expect(splitLines(words).map((l) => l.map((x) => x.word))).toEqual([
      ["Canada", "has", "paused", "new"],
      ["applications", "under"],
    ])
  })
})
