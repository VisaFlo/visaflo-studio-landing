import { describe, expect, it } from "vitest"

import { headerStep, reachedAfterNewPhoto, reachedAfterNewTake, reachedOnVisit, stepIndex, type Step } from "@/lib/studio/flow-steps"

describe("stepIndex", () => {
  it("puts each screen under its header step", () => {
    const expected: Record<Exclude<Step, "camera" | "blocked">, number> = {
      loading: 0,
      about: 0,
      "photo-guide": 1,
      photo: 1,
      "photo-review": 1,
      "video-guide": 2,
      align: 2,
      countdown: 2,
      script: 2,
      review: 2,
      topic: 3,
      submit: 4,
      done: 5,
    }
    for (const [step, index] of Object.entries(expected)) expect(stepIndex(step as Step, "photo")).toBe(index)
  })

  it("puts the camera screens under the step the camera is for", () => {
    expect(stepIndex("camera", "photo")).toBe(1)
    expect(stepIndex("blocked", "photo")).toBe(1)
    expect(stepIndex("camera", "align")).toBe(2)
    expect(stepIndex("blocked", "align")).toBe(2)
  })
})

describe("reached", () => {
  it("rises with each screen visited, never past Submit", () => {
    expect(reachedOnVisit(0, 2)).toBe(2)
    expect(reachedOnVisit(3, 1)).toBe(3)
    expect(reachedOnVisit(4, 5)).toBe(4)
  })

  it("drops back to the video step after a new photo or take, until the take is reviewed again", () => {
    expect(reachedAfterNewPhoto(4, true)).toBe(2)
    expect(reachedAfterNewPhoto(4, false)).toBe(1)
    expect(reachedAfterNewPhoto(1, true)).toBe(1)
    expect(reachedAfterNewTake(4)).toBe(2)
    expect(reachedAfterNewTake(1)).toBe(1)
  })
})

describe("headerStep", () => {
  it("opens steps up to reached, but not the current one", () => {
    expect(headerStep(0, 2, 2, false)).toEqual({ state: "done", open: true })
    expect(headerStep(2, 2, 2, false)).toEqual({ state: "current", open: false })
    expect(headerStep(3, 2, 2, false)).toEqual({ state: "todo", open: false })
    expect(headerStep(4, 1, 4, false)).toEqual({ state: "done", open: true })
  })

  it("opens nothing while busy", () => {
    for (const i of [0, 1, 2, 3]) expect(headerStep(i, 4, 4, true).open).toBe(false)
  })
})
