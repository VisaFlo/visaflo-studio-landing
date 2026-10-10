import { sampleFile, type SampleRef } from "@/lib/studio/sample/context"
import { PRICES, videoCost } from "@/lib/studio/sample/costs"
import { LIPSYNC_MODELS, pollFal, submitFal, type JobPoll } from "@/lib/studio/sample/fal"
import { pollHiggsfield } from "@/lib/studio/sample/higgsfield"
import { pollLambdaRender } from "@/lib/studio/sample/render"
import { clipSeconds, copyToSample } from "@/lib/studio/sample/stages"
import { failStage, finishStage, setJob, STAGES, timedOut, type SampleStatus, type Stage, type StageJob } from "@/lib/studio/sample/status"
import { mediaUrl, storageExists, storageMeta } from "@/lib/studio/storage"

export type PollContext = { token: string; ref: SampleRef; status: SampleStatus; now?: Date }

// A local render (npm run sample:render) is "done" once a final.mp4 newer
// than this run lands in the folder with a download token.
async function localFinal(token: string, ref: SampleRef, startedAt?: string): Promise<string | null> {
  const name = sampleFile(ref, "final.mp4")
  if (!(await storageExists(token, name))) return null
  const meta = await storageMeta(token, name)
  if (startedAt && meta.timeCreated && Date.parse(meta.timeCreated) < Date.parse(startedAt)) return null
  const downloadToken = meta.downloadTokens?.split(",")[0]
  return downloadToken ? mediaUrl(name, downloadToken) : null
}

async function askProvider(ctx: PollContext, job: StageJob, startedAt?: string): Promise<JobPoll> {
  if (job.provider === "fal") return pollFal(job)
  if (job.provider === "higgsfield") return pollHiggsfield(job)
  if (job.provider === "remotion") return pollLambdaRender(job)
  const url = await localFinal(ctx.token, ctx.ref, startedAt)
  return url ? { state: "done", videoUrl: url } : { state: "running" }
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

async function finishRender(ctx: PollContext, job: StageJob, videoUrl: string): Promise<SampleStatus> {
  const local = job.provider === "local"
  const finalUrl = local ? videoUrl : await copyToSample(ctx.token, ctx.ref, videoUrl, "final.mp4", "video/mp4")
  return finishStage(ctx.status, "render", { cost: local ? 0 : PRICES.lambdaRender, assets: { "final.mp4": finalUrl } })
}

// Called every few seconds by the admin page while something is running.
export async function pollJob(ctx: PollContext): Promise<SampleStatus> {
  const { status } = ctx
  const now = ctx.now ?? new Date()
  const stage = STAGES.find((s) => status.stages[s].state === "running") as Stage | undefined
  if (!stage) return status
  const state = status.stages[stage]
  if (timedOut(state, now, stage)) return failStage(status, stage, "The job timed out; run the stage again.", now)
  // Running inside a request with no provider job: nothing to ask yet. If the
  // request died, the timeout above is the way out.
  if (!state.job) return status

  let result: JobPoll
  try {
    result = await askProvider(ctx, state.job, state.startedAt)
  } catch (error) {
    return failStage(status, stage, error instanceof Error ? error.message : String(error), now)
  }
  if (result.state === "running") return status
  if (result.state === "failed") return failStage(status, stage, result.error, now)
  try {
    if (stage === "video") return await finishVideo(ctx, state.job, result.videoUrl)
    if (stage === "render") return await finishRender(ctx, state.job, result.videoUrl)
    return failStage(status, stage, `No finisher for ${stage}`, now)
  } catch (error) {
    return failStage(status, stage, error instanceof Error ? error.message : String(error), now)
  }
}
