import { jsonBody, openSample, sampleFile, storageFailure, writeStatus } from "@/lib/studio/sample/context"
import { storageJson, storageUpload } from "@/lib/studio/storage"

// Task 6 replaces this with the validated Script type.
type ScriptFile = {
  draft: unknown
  approved: boolean
  model: string
  createdAt: string
  editedAt?: string
  notes?: string
  searchSources: string[]
}

// The admin saved edits; `approved` is what lets Voice run.
export async function PUT(request: Request) {
  const body = await jsonBody(request)
  if (!body || typeof body.draft !== "object" || body.draft === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }
  const sample = await openSample(request, body.id)
  if (sample instanceof Response) return sample
  const path = sampleFile(sample.ref, "script.json")
  try {
    const current = await storageJson<ScriptFile>(sample.token, path)
    const next: ScriptFile = {
      ...current,
      draft: body.draft,
      approved: body.approved === true,
      editedAt: new Date().toISOString(),
    }
    await storageUpload(sample.token, path, JSON.stringify(next, null, 2), "application/json")
    const status = { ...sample.status, scriptApproved: next.approved }
    await writeStatus(sample.token, sample.ref, status)
    return Response.json({ status, script: next })
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't save the script." }, { status: 500 })
  }
}
