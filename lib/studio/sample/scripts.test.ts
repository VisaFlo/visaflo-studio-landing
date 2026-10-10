import { describe, expect, it } from "vitest"

import { OWN_TOPIC_ID, TOPICS } from "@/lib/studio/content"
import { scriptWords, validateScript } from "@/lib/studio/sample/script"
import { DEFAULT_SCRIPT_ID, templateFor, TOPIC_SCRIPTS } from "@/lib/studio/sample/scripts"

describe("topic scripts", () => {
  it("has a valid script for every Studio topic", () => {
    for (const topic of TOPICS) {
      const script = templateFor(topic.id)
      const checked = validateScript(script)
      expect(checked.ok, `${topic.id}: ${!checked.ok && checked.errors.join("; ")}`).toBe(true)
      expect(scriptWords(script)).toBeGreaterThanOrEqual(50)
      expect(scriptWords(script)).toBeLessThanOrEqual(85)
    }
  })

  it("spells IRCC for the voice and shows it in captions", () => {
    for (const script of Object.values(TOPIC_SCRIPTS)) {
      for (const line of script.lines) {
        expect(line.tts_text).not.toMatch(/\bIRCC\b/)
        expect(line.caption_text).not.toMatch(/I-R-C-C/)
      }
    }
  })

  it("falls back to the general script for own and unknown topics", () => {
    expect(templateFor(OWN_TOPIC_ID)).toBe(TOPIC_SCRIPTS[DEFAULT_SCRIPT_ID])
    expect(templateFor("nope")).toBe(TOPIC_SCRIPTS[DEFAULT_SCRIPT_ID])
    expect(templateFor(undefined)).toBe(TOPIC_SCRIPTS[DEFAULT_SCRIPT_ID])
  })
})
