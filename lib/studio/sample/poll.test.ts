import { afterEach, describe, expect, it, vi } from "vitest"

import * as fal from "@/lib/studio/sample/fal"
import * as higgsfield from "@/lib/studio/sample/higgsfield"
import { pollJob } from "@/lib/studio/sample/poll"
import * as render from "@/lib/studio/sample/render"
import * as stages from "@/lib/studio/sample/stages"
import { defaultStatus, setJob, startStage } from "@/lib/studio/sample/status"
import * as storage from "@/lib/studio/storage"

const ref = { uid: "u", submissionId: "s", folder: "studio/u/s", sampleFolder: "studio/u/s/sample" }
const falJob = { provider: "fal" as const, id: "r", statusUrl: "s", responseUrl: "r", step: "lipsync" as const }

afterEach(() => vi.restoreAllMocks())

describe("pollJob", () => {
  it("leaves a running job alone", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "running" })
    const status = setJob(startStage(defaultStatus(), "video"), "video", falJob)
    const next = await pollJob({ token: "t", ref, status })
    expect(next.stages.video.state).toBe("running")
  })

  it("copies a finished lipsync into talking.mp4 and prices it", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "done", videoUrl: "https://out/v.mp4" })
    const copy = vi.spyOn(stages, "copyToSample").mockResolvedValue("https://bucket/talking.mp4")
    const status = { ...setJob(startStage(defaultStatus(), "video"), "video", falJob), speechSeconds: 25 }
    const next = await pollJob({ token: "t", ref, status })
    expect(copy).toHaveBeenCalledWith("t", ref, "https://out/v.mp4", "talking.mp4", "video/mp4")
    expect(next.stages.video.state).toBe("done")
    expect(next.assets["talking.mp4"]).toBe("https://bucket/talking.mp4")
    expect(next.stages.video.cost).toBeCloseTo(2.17, 2) // 26 s of lipsync-2-pro
  })

  it("chains Seedance into lipsync with the chosen lipsync model", async () => {
    vi.spyOn(higgsfield, "pollHiggsfield").mockResolvedValue({ state: "done", videoUrl: "https://h/scene.mp4" })
    vi.spyOn(stages, "copyToSample").mockResolvedValue("https://bucket/scene.mp4")
    const submit = vi.spyOn(fal, "submitFal").mockResolvedValue({ provider: "fal", id: "r2", statusUrl: "s2", responseUrl: "r2" })
    const base = defaultStatus()
    const status = setJob(
      startStage({ ...base, options: { ...base.options, lipsync: "standard" }, speechSeconds: 25, assets: { "speech.mp3": "https://bucket/speech.mp3" } }, "video"),
      "video",
      { provider: "higgsfield", id: "h", statusUrl: "hs", step: "scene" },
    )
    const next = await pollJob({ token: "t", ref, status })
    expect(submit).toHaveBeenCalledWith(fal.LIPSYNC_MODELS.standard, {
      video_url: "https://bucket/scene.mp4",
      audio_url: "https://bucket/speech.mp3",
      sync_mode: "cut_off",
    })
    expect(next.stages.video.state).toBe("running")
    expect(next.stages.video.job).toMatchObject({ provider: "fal", id: "r2", step: "lipsync" })
    expect(next.assets["scene.mp4"]).toBe("https://bucket/scene.mp4")
  })

  it("fails the stage when the provider fails", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "failed", error: "bad audio" })
    const status = setJob(startStage(defaultStatus(), "video"), "video", falJob)
    const next = await pollJob({ token: "t", ref, status })
    expect(next.stages.video).toMatchObject({ state: "failed", error: expect.stringContaining("bad audio") })
  })

  it("times out a job that never finishes", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "running" })
    const started = new Date("2026-10-09T10:00:00Z")
    const status = setJob(startStage(defaultStatus(), "video", started), "video", falJob)
    const next = await pollJob({ token: "t", ref, status, now: new Date("2026-10-09T10:20:00Z") })
    expect(next.stages.video).toMatchObject({ state: "failed", error: expect.stringContaining("timed out") })
  })

  it("does nothing when nothing is running", async () => {
    const status = defaultStatus()
    expect(await pollJob({ token: "t", ref, status })).toEqual(status)
  })

  it("finishes a local render once a final.mp4 newer than the run is in the folder", async () => {
    vi.spyOn(storage, "storageExists").mockResolvedValue(false)
    const started = new Date("2026-10-09T10:00:00Z")
    const now = new Date("2026-10-09T10:06:00Z")
    const status = setJob(startStage(defaultStatus(), "render", started), "render", { provider: "local", id: "render-props.json" })
    expect((await pollJob({ token: "t", ref, status, now })).stages.render.state).toBe("running")

    // A final.mp4 left over from an earlier run doesn't count.
    vi.spyOn(storage, "storageExists").mockResolvedValue(true)
    vi.spyOn(storage, "storageMeta").mockResolvedValue({ name: "studio/u/s/sample/final.mp4", downloadTokens: "old", timeCreated: "2026-10-09T09:00:00Z" })
    expect((await pollJob({ token: "t", ref, status, now })).stages.render.state).toBe("running")

    vi.spyOn(storage, "storageMeta").mockResolvedValue({ name: "studio/u/s/sample/final.mp4", downloadTokens: "tok", timeCreated: "2026-10-09T10:05:00Z" })
    const next = await pollJob({ token: "t", ref, status, now })
    expect(next.stages.render.state).toBe("done")
    expect(next.assets["final.mp4"]).toContain("final.mp4?alt=media&token=tok")
    expect(next.stages.render.cost).toBe(0)
  })

  it("times out a stage left running with no job (the run died mid-way)", async () => {
    const started = new Date("2026-10-09T10:00:00Z")
    const status = startStage(defaultStatus(), "prep", started)
    expect((await pollJob({ token: "t", ref, status, now: new Date("2026-10-09T10:03:00Z") })).stages.prep.state).toBe("running")
    const next = await pollJob({ token: "t", ref, status, now: new Date("2026-10-09T10:06:00Z") })
    expect(next.stages.prep).toMatchObject({ state: "failed", error: expect.stringContaining("timed out") })
  })

  it("copies a finished Lambda render into final.mp4", async () => {
    vi.spyOn(render, "pollLambdaRender").mockResolvedValue({ state: "done", videoUrl: "https://s3/out.mp4" })
    const copy = vi.spyOn(stages, "copyToSample").mockResolvedValue("https://bucket/final.mp4")
    const status = setJob(startStage(defaultStatus(), "render"), "render", { provider: "remotion", id: "rid", bucketName: "b" })
    const next = await pollJob({ token: "t", ref, status })
    expect(copy).toHaveBeenCalledWith("t", ref, "https://s3/out.mp4", "final.mp4", "video/mp4")
    expect(next.stages.render.state).toBe("done")
    expect(next.assets["final.mp4"]).toBe("https://bucket/final.mp4")
    expect(next.stages.render.cost).toBeCloseTo(0.02, 2)
  })
})
