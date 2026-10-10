import { openSample, storageFailure, writeStatus } from "@/lib/studio/sample/context"
import { pollJob } from "@/lib/studio/sample/poll"

export const maxDuration = 300

export async function GET(request: Request) {
  const sample = await openSample(request)
  if (sample instanceof Response) return sample
  const next = await pollJob({ token: sample.token, ref: sample.ref, status: sample.status })
  if (next !== sample.status) {
    try {
      await writeStatus(sample.token, sample.ref, next)
    } catch (error) {
      return storageFailure(error) ?? Response.json({ error: "We couldn't save the sample status." }, { status: 500 })
    }
  }
  return Response.json(next)
}
