import { describe, expect, it } from "vitest"

import { AUTO_STAGES, nextAutoStep } from "@/lib/studio/sample/auto"
import { defaultStatus, failStage, finishStage, startStage, type SampleStatus, type Stage } from "@/lib/studio/sample/status"

function withDone(status: SampleStatus, ...stages: Stage[]): SampleStatus {
  return stages.reduce((s, stage) => finishStage(startStage(s, stage), stage), status)
}

const approved = (s: SampleStatus): SampleStatus => ({ ...s, scriptApproved: true })

describe("nextAutoStep", () => {
  it("runs the six stages in order, Prep first on a fresh sample", () => {
    expect(AUTO_STAGES).toEqual(["prep", "script", "voice", "video", "audio", "render"])
    expect(nextAutoStep(defaultStatus())).toEqual({ kind: "run", stage: "prep" })
  })

  it("moves to the first stage that is not done", () => {
    const s = approved(withDone(defaultStatus(), "prep", "script"))
    expect(nextAutoStep(s)).toEqual({ kind: "run", stage: "voice" })
    expect(nextAutoStep(withDone(s, "voice", "video"))).toEqual({ kind: "run", stage: "audio" })
  })

  it("waits while a stage is running", () => {
    const s = startStage(approved(withDone(defaultStatus(), "prep", "script", "voice")), "video")
    expect(nextAutoStep(s)).toEqual({ kind: "wait", stage: "video" })
  })

  it("stops with the reason when the next stage can't start", () => {
    const draft = withDone(defaultStatus(), "prep", "script")
    expect(nextAutoStep(draft)).toEqual({ kind: "blocked", stage: "voice", reasons: ["Approve the script first."] })

    const scene = approved(withDone(defaultStatus(), "prep", "script", "voice"))
    const noFrame = { ...scene, options: { ...scene.options, method: "scene" as const } }
    expect(nextAutoStep(noFrame)).toEqual({ kind: "blocked", stage: "video", reasons: ["Pick a face frame first."] })
  })

  it("re-runs a stale stage after an earlier one was redone, skipping done stages that don't depend on it", () => {
    const all = approved(withDone(defaultStatus(), "prep", "script", "voice", "video", "audio", "render"))
    const redone = finishStage(startStage(all, "prep"), "prep")
    expect(redone.stages.script.state).toBe("done")
    expect(nextAutoStep(redone)).toEqual({ kind: "run", stage: "voice" })
  })

  it("offers a failed stage again as a retry", () => {
    const s = failStage(startStage(approved(withDone(defaultStatus(), "prep", "script")), "voice"), "voice", "ElevenLabs 500")
    expect(nextAutoStep(s)).toEqual({ kind: "retry", stage: "voice" })
  })

  it("is done when all six stages are done", () => {
    const all = approved(withDone(defaultStatus(), "prep", "script", "voice", "video", "audio", "render"))
    expect(nextAutoStep(all)).toEqual({ kind: "done" })
  })
})
