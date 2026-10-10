import { getRenderProgress, renderMediaOnLambda, type AwsRegion } from "@remotion/lambda/client"

import type { JobPoll } from "@/lib/studio/sample/fal"
import type { Script } from "@/lib/studio/sample/script"
import type { SampleStatus, StageJob } from "@/lib/studio/sample/status"
import type { Word } from "@/lib/studio/sample/words"
import type { SampleProps } from "@/remotion/types"

const ASSETS = ["talking.mp4", "speech.mp3", "music.mp3", "sfx-whoosh.mp3", "sfx-pop.mp3"] as const

export function renderProps(status: SampleStatus, script: Script, words: Word[]): SampleProps {
  for (const name of ASSETS) if (!status.assets[name]) throw new Error(`Missing ${name}; run the stage that makes it`)
  if (!status.speechSeconds) throw new Error("Run Voice first")
  return {
    talkingUrl: status.assets["talking.mp4"],
    speechUrl: status.assets["speech.mp3"],
    musicUrl: status.assets["music.mp3"],
    sfxWhooshUrl: status.assets["sfx-whoosh.mp3"],
    sfxPopUrl: status.assets["sfx-pop.mp3"],
    words,
    cards: script.cards,
    layout: status.options.layout,
    headline: script.headline,
    speechSeconds: status.speechSeconds,
  }
}

type Env = Record<string, string | undefined>

function lambda(env: Env = process.env) {
  const functionName = env.REMOTION_FUNCTION_NAME
  const serveUrl = env.REMOTION_SERVE_URL
  const region = env.REMOTION_REGION as AwsRegion | undefined
  return functionName && serveUrl && region ? { functionName, serveUrl, region } : null
}

export function lambdaConfigured(env: Env = process.env): boolean {
  return lambda(env) !== null
}

// @remotion/lambda reads REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY itself.
export async function startLambdaRender(props: SampleProps): Promise<StageJob> {
  const cfg = lambda()
  if (!cfg) throw new Error("Remotion Lambda is not configured")
  const { renderId, bucketName } = await renderMediaOnLambda({
    ...cfg,
    composition: "Sample",
    inputProps: props,
    codec: "h264",
    privacy: "public",
    downloadBehavior: { type: "play-in-browser" },
  })
  return { provider: "remotion", id: renderId, bucketName }
}

export async function pollLambdaRender(job: StageJob): Promise<JobPoll> {
  const cfg = lambda()
  if (!cfg || !job.bucketName) return { state: "failed", error: "Remotion Lambda is not configured" }
  const progress = await getRenderProgress({ renderId: job.id, bucketName: job.bucketName, functionName: cfg.functionName, region: cfg.region })
  if (progress.fatalErrorEncountered) {
    return { state: "failed", error: `Render failed: ${progress.errors.map((e) => e.message).join("; ").slice(0, 300)}` }
  }
  if (progress.done && progress.outputFile) return { state: "done", videoUrl: progress.outputFile }
  return { state: "running" }
}
