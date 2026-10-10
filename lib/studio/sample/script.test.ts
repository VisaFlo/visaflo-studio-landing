import { describe, expect, it } from "vitest"

import { SCRIPT_SYSTEM_PROMPT, scriptUserPrompt, scriptWords, stripTags, validateScript, type Script } from "@/lib/studio/sample/script"

const good: Script = {
  headline: "Express Entry draw invites 1,000 healthcare workers",
  published: "2026-10-07",
  lines: [
    {
      tts_text: "[confident] I-R-C-C just ran a new Express Entry draw, and it is aimed at healthcare.",
      caption_text: "IRCC just ran a new Express Entry draw, and it is aimed at healthcare.",
    },
    {
      tts_text: "On October seventh, one thousand invitations went out to healthcare and social services workers.",
      caption_text: "On October 7, 1,000 invitations went out to healthcare and social services workers.",
    },
    { tts_text: "The cut-off score was four hundred and sixty two.", caption_text: "The cut-off score was 462." },
    {
      tts_text: "If you work in healthcare and your profile is ready, this is the category to watch.",
      caption_text: "If you work in healthcare and your profile is ready, this is the category to watch.",
    },
    {
      tts_text: "Not sure where your score sits? Talk to a licensed professional before you act.",
      caption_text: "Not sure where your score sits? Talk to a licensed professional before you act.",
    },
    {
      tts_text: "I post a short update like this every week, so follow along for the next one.",
      caption_text: "I post a short update like this every week, so follow along for the next one.",
    },
  ],
  cards: [
    { line: 1, label: "Invitations", value: "1,000", sub: "Healthcare & social services" },
    { line: 2, label: "CRS cut-off", value: "462", sub: null },
  ],
  sources: [
    {
      url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html",
      title: "Express Entry rounds of invitations",
    },
  ],
  facts: [{ claim: "1,000 ITAs on October 7", source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/x.html" }],
  estimated_seconds: 25,
}

describe("validateScript", () => {
  it("accepts a well-formed script", () => {
    const r = validateScript(good)
    expect(r.ok).toBe(true)
  })
  it("rejects captions with tags, long values, non-canada.ca sources, bad card lines", () => {
    const bad = {
      ...good,
      lines: [{ tts_text: "[warm] hi", caption_text: "[warm] hi" }, ...good.lines.slice(1)],
      cards: [{ line: 9, label: "x".repeat(29), value: "1,000,000,000,000", sub: null }],
      sources: [{ url: "https://cicnews.com/x", title: "t" }],
    }
    const r = validateScript(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const all = r.errors.join("\n")
      expect(all).toMatch(/caption.*tag/i)
      expect(all).toMatch(/value.*12/i)
      expect(all).toMatch(/label.*28/i)
      expect(all).toMatch(/card.*line/i)
      expect(all).toMatch(/canada\.ca/)
    }
  })
  it("rejects scripts far outside the word budget", () => {
    const r = validateScript({ ...good, lines: good.lines.slice(0, 3) })
    expect(r.ok).toBe(false)
  })
  it("rejects garbage", () => {
    expect(validateScript(null).ok).toBe(false)
    expect(validateScript({ lines: "x" }).ok).toBe(false)
  })
})

describe("helpers", () => {
  it("counts spoken words without tags", () => {
    expect(stripTags("[confident] I-R-C-C just ran")).toBe("I-R-C-C just ran")
    expect(scriptWords(good)).toBeGreaterThan(60)
  })
  it("puts the rules in the prompts", () => {
    expect(SCRIPT_SYSTEM_PROMPT).toContain("I-R-C-C")
    expect(SCRIPT_SYSTEM_PROMPT).toContain("65 to 85 words")
    expect(SCRIPT_SYSTEM_PROMPT).toContain("canada.ca")
    const u = scriptUserPrompt({ topic: "Study permits", today: "2026-10-09", notes: "use the cap numbers" })
    expect(u).toContain("Study permits")
    expect(u).toContain("2026-10-09")
    expect(u).toContain("use the cap numbers")
  })
})
