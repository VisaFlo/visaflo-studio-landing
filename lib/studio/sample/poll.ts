import type { SampleRef } from "@/lib/studio/sample/context"
import { videoCost } from "@/lib/studio/sample/costs"
import { LIPSYNC_MODELS, pollFal, submitFal, type JobPoll } from "@/lib/studio/sample/fal"
import { pollHiggsfield } from "@/lib/studio/sample/higgsfield"
import { clipSeconds, copyToSample } from "@/lib/studio/sample/stages"
import { failStage, finishStage, setJob, STAGES, timedOut, type SampleStatus, type Stage, type StageJob } from "@/lib/studio/sample/status"

export type PollContext = { token: string; ref: SampleRef; status: SampleStatus; now?: Date }

async function askProvider(job: StageJob): Promise<JobPoll> {
  if (job.provider === "fal") return pollFal(job)
  if (job.provider === "higgsfield") return pollHiggsfield(job)
  return { state: "failed", error: `No poller for ${job.provider}` }
}

async function finishVideo(ctx: PollContext, job: StageJob, videoUrl: string): Promise<SampleStatus> {
  const { token, ref, status } = ctx
  if (job.step === "scene") {
    // Seedance is done; now fit the mouth to the real speech.
    const sceneUrl = await copyToSample(token, ref, videoUrl, "scene.mp4", "video/mp4")
    const speechUrl = status.assets["speech.mp3"]
    const next = await submitFal(LIPSYNC_MODELS[status.options.lipsync], { video_url: sceneUrl, audio_url: speechUrl, sync_mode: "cut_off" })
    return setJob({ ...status, assets: { ...status.assets, "scene.mp4": sceneUrl } }, "video", { ...next, step: "lipsync" })
  }
  const talkingUrl = await copyToSample(token, ref, videoUrl, "talking.mp4", "video/mp4")
  const seconds = clipSeconds(status.speechSeconds ?? 25)
  return finishStage(status, "video", {
    cost: videoCost(status.options.method, seconds, status.options.lipsync),
    assets: { "talking.mp4": talkingUrl },
  })
}

// Called every few seconds by the admin page while something is running.
export async function pollJob(ctx: PollContext): Promise<SampleStatus> {
  const { status } = ctx
  const now = ctx.now ?? new Date()
  const stage = STAGES.find((s) => status.stages[s].state === "running" && status.stages[s].job) as Stage | undefined
  if (!stage) return status
  const state = status.stages[stage]
  if (timedOut(state, now, stage)) return failStage(status, stage, "The job timed out; run the stage again.", now)

  let result: JobPoll
  try {
    result = await askProvider(state.job!)
  } catch (error) {
    return failStage(status, stage, error instanceof Error ? error.message : String(error), now)
  }
  if (result.state === "running") return status
  if (result.state === "failed") return failStage(status, stage, result.error, now)
  try {
    if (stage === "video") return await finishVideo(ctx, state.job!, result.videoUrl)
    return failStage(status, stage, `No finisher for ${stage}`, now)
  } catch (error) {
    return failStage(status, stage, error instanceof Error ? error.message : String(error), now)
  }
}
