import { jsonBody, openSample, sampleFile, storageFailure, writeStatus } from "@/lib/studio/sample/context"
import { validateScript, type ScriptFile } from "@/lib/studio/sample/script"
import { markStale } from "@/lib/studio/sample/status"
import { StorageError, storageJson, storageUpload } from "@/lib/studio/storage"

// The current script.json, or null before the Script stage has run.
export async function GET(request: Request) {
  const sample = await openSample(request)
  if (sample instanceof Response) return sample
  try {
    return Response.json(await storageJson<ScriptFile>(sample.token, sampleFile(sample.ref, "script.json")))
  } catch (error) {
    if (error instanceof StorageError && error.status === 404) return Response.json(null)
    return storageFailure(error) ?? Response.json({ error: "We couldn't read the script." }, { status: 500 })
  }
}

// The admin saved edits; `approved` is what lets Voice run.
export async function PUT(request: Request) {
  const body = await jsonBody(request)
  if (!body || typeof body.draft !== "object" || body.draft === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }
  const checked = validateScript(body.draft)
  if (!checked.ok) return Response.json({ error: checked.errors.join(" · ") }, { status: 400 })

  const sample = await openSample(request, body.id)
  if (sample instanceof Response) return sample
  const path = sampleFile(sample.ref, "script.json")
  try {
    const current = await storageJson<ScriptFile>(sample.token, path)
    const next: ScriptFile = {
      ...current,
      draft: checked.script,
      approved: body.approved === true,
      editedAt: new Date().toISOString(),
    }
    await storageUpload(sample.token, path, JSON.stringify(next, null, 2), "application/json")
    // The spoken lines feed Voice (and the captions it times), so changing
    // them makes the voice and everything after it out of date.
    const linesChanged = JSON.stringify(current.draft.lines) !== JSON.stringify(next.draft.lines)
    const status = { ...(linesChanged ? markStale(sample.status, "voice") : sample.status), scriptApproved: next.approved }
    await writeStatus(sample.token, sample.ref, status)
    return Response.json({ status, script: next })
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't save the script." }, { status: 500 })
  }
}
