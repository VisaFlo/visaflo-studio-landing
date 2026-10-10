import { jsonBody, openSample, parseOptions, storageFailure, writeStatus } from "@/lib/studio/sample/context"

export async function PUT(request: Request) {
  const body = await jsonBody(request)
  if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 })
  const sample = await openSample(request, body.id)
  if (sample instanceof Response) return sample
  const status = { ...sample.status, options: parseOptions(body.options, sample.status.options) }
  try {
    await writeStatus(sample.token, sample.ref, status)
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't save the options." }, { status: 500 })
  }
  return Response.json(status)
}
