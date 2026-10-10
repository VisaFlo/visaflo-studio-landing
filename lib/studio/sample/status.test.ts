import { describe, expect, it } from "vitest"

import {
  blockers,
  defaultStatus,
  failStage,
  finishStage,
  keepStages,
  markStale,
  mergeStageResult,
  startStage,
  timedOut,
  type SampleStatus,
  type Stage,
} from "@/lib/studio/sample/status"

function withDone(status: SampleStatus, ...stages: Stage[]): SampleStatus {
  return stages.reduce((s, stage) => finishStage(startStage(s, stage), stage), status)
}

describe("defaultStatus", () => {
  it("fills the vertical frame like a phone video unless the admin picks the boxed layout", () => {
    expect(defaultStatus().options.layout).toBe("full")
  })
})

describe("blockers", () => {
  it("lets prep and script run on a fresh status", () => {
    const s = defaultStatus()
    expect(blockers(s, "prep")).toEqual([])
    expect(blockers(s, "script")).toEqual([])
  })

  it("holds voice until prep is done and the script is approved", () => {
    const s = withDone(defaultStatus(), "prep", "script")
    expect(blockers(s, "voice")).toEqual(["Approve the script first."])
    expect(blockers({ ...s, scriptApproved: true }, "voice")).toEqual([])
    expect(blockers({ ...withDone(defaultStatus(), "script"), scriptApproved: true }, "voice")).toEqual(["Run Prep first."])
  })

  it("needs a picked face frame for scene and portrait, not for real", () => {
    const base = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice")
    expect(blockers({ ...base, options: { ...base.options, method: "scene" } }, "video")).toEqual(["Pick a face frame first."])
    expect(blockers({ ...base, options: { ...base.options, method: "portrait", faceFrame: 3 } }, "video")).toEqual([])
    expect(blockers({ ...base, options: { ...base.options, method: "real" } }, "video")).toEqual([])
  })

  it("refuses to run while already running", () => {
    const s = startStage(defaultStatus(), "prep")
    expect(blockers(s, "prep")).toEqual(["Prep is already running."])
  })
})

describe("startStage", () => {
  it("marks later finished stages stale and leaves earlier ones alone", () => {
    const s = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice", "audio")
    const again = startStage(s, "script")
    expect(again.stages.script.state).toBe("running")
    expect(again.stages.prep.state).toBe("done")
    expect(again.stages.voice.state).toBe("stale")
    expect(again.stages.audio.state).toBe("stale")
    expect(again.stages.video.state).toBe("idle")
    expect(again.scriptApproved).toBe(false)
  })

  it("only stales stages that depend on the one re-run", () => {
    const s = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice", "video", "audio", "render")
    const prepAgain = startStage(s, "prep")
    expect(prepAgain.stages.script.state).toBe("done") // Script doesn't use Prep's output
    expect(prepAgain.stages.voice.state).toBe("stale")
    expect(prepAgain.stages.render.state).toBe("stale")
    const videoAgain = startStage(s, "video")
    expect(videoAgain.stages.audio.state).toBe("done") // Audio only needs Voice
    expect(videoAgain.stages.render.state).toBe("stale")
  })

  it("exposes staling on its own for script edits", () => {
    const s = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice", "audio")
    const edited = markStale(s, "voice")
    expect(edited.stages.voice.state).toBe("stale")
    expect(edited.stages.audio.state).toBe("stale")
    expect(edited.stages.script.state).toBe("done")
  })

  it("blocks video when voice is stale", () => {
    const s = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice")
    const again = finishStage(startStage(s, "script"), "script")
    expect(blockers({ ...again, scriptApproved: true }, "video")).toEqual(["Run Voice again first."])
  })

  it("clears the previous error and job", () => {
    const failed = failStage(startStage(defaultStatus(), "prep"), "prep", "boom")
    const retry = startStage(failed, "prep")
    expect(retry.stages.prep.error).toBeUndefined()
    expect(retry.stages.prep.state).toBe("running")
  })
})

describe("finishStage / failStage", () => {
  it("records cost, finishedAt and patches", () => {
    const s = finishStage(startStage(defaultStatus(), "voice"), "voice", { cost: 0.05, voiceId: "v1", speechSeconds: 24.2 })
    expect(s.stages.voice).toMatchObject({ state: "done", cost: 0.05 })
    expect(s.stages.voice.finishedAt).toBeTruthy()
    expect(s.voiceId).toBe("v1")
    expect(s.speechSeconds).toBe(24.2)
  })

  it("merges assets instead of replacing them", () => {
    const a = finishStage(startStage(defaultStatus(), "prep"), "prep", { assets: { "face-1.jpg": "u1" } })
    const b = finishStage(startStage(a, "voice"), "voice", { assets: { "speech.mp3": "u2" } })
    expect(b.assets).toEqual({ "face-1.jpg": "u1", "speech.mp3": "u2" })
  })

  it("keeps the error short", () => {
    const s = failStage(startStage(defaultStatus(), "prep"), "prep", "x".repeat(1000))
    expect(s.stages.prep.state).toBe("failed")
    expect(s.stages.prep.error!.length).toBeLessThanOrEqual(400)
  })
})

describe("mergeStageResult", () => {
  it("applies one stage's result onto a fresher status without undoing other stages", () => {
    // What the run route read at the start, then finished Audio on.
    const start = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice")
    const ran = finishStage(startStage(start, "audio"), "audio", { cost: 0.3, assets: { "music.mp3": "m" } })
    // Meanwhile the poller finished Video and added talking.mp4.
    const fresh = finishStage(startStage(start, "video"), "video", { cost: 2, assets: { "talking.mp4": "t" } })
    const merged = mergeStageResult(fresh, ran, "audio")
    expect(merged.stages.video.state).toBe("done")
    expect(merged.stages.audio).toMatchObject({ state: "done", cost: 0.3 })
    expect(merged.assets).toEqual({ "talking.mp4": "t", "music.mp3": "m" })
  })

  it("carries the fields the stage produced and the staling it caused", () => {
    const start = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice", "audio")
    const ran = finishStage(startStage(start, "voice"), "voice", { voiceId: "v2", speechSeconds: 21 })
    const merged = mergeStageResult(start, ran, "voice")
    expect(merged.voiceId).toBe("v2")
    expect(merged.speechSeconds).toBe(21)
    expect(merged.stages.audio.state).toBe("stale")
  })
})

describe("timedOut", () => {
  it("uses the per-stage limit", () => {
    const started = new Date("2026-10-09T10:00:00Z")
    const s = startStage(defaultStatus(), "video", started)
    expect(timedOut(s.stages.video, new Date("2026-10-09T10:14:00Z"), "video")).toBe(false)
    expect(timedOut(s.stages.video, new Date("2026-10-09T10:16:00Z"), "video")).toBe(true)
    const r = startStage(defaultStatus(), "render", started)
    expect(timedOut(r.stages.render, new Date("2026-10-09T10:11:00Z"), "render")).toBe(true)
  })
})

describe("keepStages", () => {
  it("gives back stages a re-run marked stale when their input turned out unchanged", () => {
    const before = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice", "video", "audio", "render")
    const after = finishStage(startStage(before, "script"), "script", { scriptApproved: true })
    expect(after.stages.voice.state).toBe("stale")
    const kept = keepStages(before, after, ["voice", "video", "audio"])
    expect(kept.stages.voice).toEqual(before.stages.voice)
    expect(kept.stages.video.state).toBe("done")
    expect(kept.stages.audio.state).toBe("done")
    // Render still used the old cards, so it stays stale; script is the fresh run.
    expect(kept.stages.render.state).toBe("stale")
    expect(kept.stages.script.state).toBe("done")
  })
  it("doesn't resurrect a stage that wasn't done before", () => {
    const before = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script")
    const after = finishStage(startStage(before, "script"), "script", { scriptApproved: true })
    expect(keepStages(before, after, ["voice"]).stages.voice.state).toBe("idle")
  })
})
