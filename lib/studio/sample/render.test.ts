import { describe, expect, it } from "vitest"

import { renderProps } from "@/lib/studio/sample/render"
import { defaultStatus } from "@/lib/studio/sample/status"

describe("renderProps", () => {
  it("collects every asset url and the script parts the composition needs", () => {
    const status = {
      ...defaultStatus(),
      speechSeconds: 24.5,
      assets: {
        "talking.mp4": "t",
        "speech.mp3": "s",
        "music.mp3": "m",
        "sfx-whoosh.mp3": "w",
        "sfx-pop.mp3": "p",
      },
    }
    const script = { headline: "H", published: "2026-09-29", cards: [{ line: 0, label: "L", value: "V", sub: null }] } as never
    const words = [{ word: "a", start: 0, end: 0.3, line: 0 }]
    expect(renderProps(status, script, words, { palette: "wine", topicTitle: "Express Entry draw" })).toEqual({
      talkingUrl: "t",
      speechUrl: "s",
      musicUrl: "m",
      sfxWhooshUrl: "w",
      sfxPopUrl: "p",
      words,
      cards: [{ line: 0, label: "L", value: "V", sub: null }],
      layout: "full",
      headline: "H",
      published: "2026-09-29",
      topicTitle: "Express Entry draw",
      palette: "wine",
      speechSeconds: 24.5,
    })
  })
  it("refuses when an asset is missing", () => {
    expect(() =>
      renderProps({ ...defaultStatus(), speechSeconds: 20 }, { headline: "H", cards: [] } as never, [], { palette: "navy", topicTitle: "" }),
    ).toThrow(/talking\.mp4/)
  })
})
