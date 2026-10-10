import { jsonBody, openSample, storageFailure, writeStatus } from "@/lib/studio/sample/context"
import { describeError, STAGE_WORK } from "@/lib/studio/sample/stages"
import { blockers, failStage, finishStage, setJob, STAGES, startStage, type Stage } from "@/lib/studio/sample/status"

// Downloads, ffmpeg and provider calls can take a few minutes.
export const maxDuration = 300

export async function POST(request: Request, { params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params
  const work = STAGES.includes(stage as Stage) ? STAGE_WORK[stage as Stage] : undefined
  if (!work) return Response.json({ error: "Unknown stage." }, { status: 404 })

  const body = (await jsonBody(request)) ?? {}
  const sample = await openSample(request, body.id)
  if (sample instanceof Response) return sample
  const { token, ref } = sample

  const reasons = blockers(sample.status, stage as Stage)
  if (reasons.length) return Response.json({ error: reasons.join(" "), status: sample.status }, { status: 409 })

  let status = startStage(sample.status, stage as Stage)
  try {
    await writeStatus(token, ref, status)
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't save the sample status." }, { status: 500 })
  }

  try {
    const outcome = await work({ token, ref, status, body })
    status = outcome.done
      ? finishStage(status, stage as Stage, { cost: outcome.cost, ...outcome.patch })
      : setJob(status, stage as Stage, outcome.job)
  } catch (error) {
    console.error(`Sample stage ${stage} failed for ${ref.folder}`, error)
    status = failStage(status, stage as Stage, describeError(error))
  }
  await writeStatus(token, ref, status)
  return Response.json(status)
}
