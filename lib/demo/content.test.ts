import { describe, expect, it } from "vitest"

import { buildScript, CTAS, DEMO, estimateSeconds, formatDuration, NEWS } from "@/lib/demo/content"

describe("buildScript", () => {
  it("writes the hook, one body line and the ending for a short script", () => {
    expect(buildScript("n1", "plain", "follow", "short").split("\n")).toHaveLength(3)
  })
  it("uses every body line for a standard script and adds one more for a long one", () => {
    for (const story of NEWS) {
      const standard = buildScript(story.id, "plain", "follow", "standard").split("\n")
      const long = buildScript(story.id, "plain", "follow", "long").split("\n")
      expect(standard).toHaveLength(story.body.length + 2)
      expect(long).toHaveLength(standard.length + 1)
    }
  })
  it("opens with the story's hook in the chosen tone", () => {
    const story = NEWS.find((n) => n.id === "n2")!
    expect(buildScript("n2", "urgent", "follow", "standard").split("\n")[0]).toBe(story.hooks.urgent)
    expect(buildScript("n2", "friendly", "follow", "standard").split("\n")[0]).toBe(story.hooks.friendly)
  })
  it("ends with the chosen call to action, or the last body line with no ending", () => {
    const lines = buildScript("n3", "plain", "book", "short").split("\n")
    expect(lines[lines.length - 1]).toBe(CTAS.find((c) => c.id === "book")!.line)
    const bare = buildScript("n3", "plain", "none", "standard").split("\n")
    expect(bare[bare.length - 1]).toBe(NEWS.find((n) => n.id === "n3")!.body.at(-1))
  })
})

describe("the locked demo path", () => {
  it("writes word for word what the demo video says", () => {
    const script = buildScript(DEMO.storyId, DEMO.tone, DEMO.cta, DEMO.length)
    expect(script.split("\n").join(" ")).toBe(
      "Okay, this one's big. If you're in Canada on a work permit, starting this month, eligible work permit holders can study a program of up to six months, no separate study permit needed. Two things to check before you enroll. One, your work permit has to stay valid for the whole program. Two, the program has to be six months or less. Anything longer still needs a study permit.",
    )
  })
  it("estimates the same length as the video", () => {
    expect(estimateSeconds(buildScript(DEMO.storyId, DEMO.tone, DEMO.cta, DEMO.length))).toBe(DEMO.videoSeconds)
  })
})

describe("estimateSeconds", () => {
  it("reads at 2.75 words a second", () => {
    expect(estimateSeconds(Array(55).fill("word").join(" "))).toBe(20)
  })
  it("never estimates under 8 seconds, even for an empty script", () => {
    expect(estimateSeconds("")).toBe(8)
    expect(estimateSeconds("Just a few words")).toBe(8)
  })
  it("ignores extra whitespace and line breaks", () => {
    expect(estimateSeconds("  one\n\ntwo   three \n")).toBe(estimateSeconds("one two three"))
  })
})

describe("formatDuration", () => {
  it("shows minutes and two-digit seconds", () => {
    expect(formatDuration(8)).toBe("0:08")
    expect(formatDuration(25)).toBe("0:25")
    expect(formatDuration(64)).toBe("1:04")
  })
})
