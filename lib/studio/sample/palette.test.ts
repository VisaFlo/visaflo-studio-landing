import { describe, expect, it } from "vitest"

import { paletteFor } from "@/lib/studio/sample/palette"

describe("paletteFor", () => {
  it("gives each topic the look its landing sample has", () => {
    expect(paletteFor("express-entry")).toBe("wine")
    expect(paletteFor("study-permits")).toBe("forest")
    expect(paletteFor("work-permits")).toBe("paper")
    expect(paletteFor("family")).toBe("navy")
  })
  it("falls back to navy for an own topic or none", () => {
    expect(paletteFor("own")).toBe("navy")
    expect(paletteFor(undefined)).toBe("navy")
  })
})
