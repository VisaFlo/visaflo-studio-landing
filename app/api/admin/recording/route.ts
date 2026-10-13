import { requireAdmin } from "@/lib/studio/admin-auth"
import { storageFailure } from "@/lib/studio/admin-errors"
import { readRequestJson, type RequestJson } from "@/lib/studio/request-json"
import { listObjects, storageGet, storageJson, StorageError } from "@/lib/studio/storage"
import { downloadName, parseSubmissionId, recordingObject, submissionFolder } from "@/lib/studio/submissions"

// One submission's original recording as a file download
// (?id=uid/submissionId). The bytes stream through here because the bucket
// serves them inline and a cross-origin link can't force a download; the
// admin's own ID token is what reads the object, so the storage rules decide.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const ref = parseSubmissionId(new URL(request.url).searchParams.get("id"))
  if (!ref) return Response.json({ error: "Unknown submission." }, { status: 400 })
  const folder = submissionFolder(ref)
  const who = `${ref.uid}/${ref.submissionId}`

  try {
    const { items } = await listObjects(admin.token, `${folder}/`)
    const recording = recordingObject(items)
    if (!recording) return Response.json({ error: "No recording in that folder." }, { status: 404 })

    // The name only decides the file name, so a missing or broken
    // request.json falls back to the uid; a refused read still fails the
    // whole download (it would fail the bytes too).
    const details = await storageJson<unknown>(admin.token, `${folder}/request.json`)
      .then(readRequestJson)
      .catch((error: unknown): RequestJson => {
        if (error instanceof StorageError && error.refused) throw error
        if (!(error instanceof StorageError && error.status === 404)) console.error(`Could not read request.json for ${who}`, error)
        return {}
      })

    const media = await storageGet(admin.token, `/${encodeURIComponent(recording)}?alt=media`)
    const headers = new Headers({
      "Content-Type": media.headers.get("content-type") ?? "video/mp4",
      "Content-Disposition": `attachment; filename="${downloadName(details, ref, recording)}"`,
      "Cache-Control": "private, no-store",
    })
    const length = media.headers.get("content-length")
    if (length) headers.set("Content-Length", length)

    // The body is handed back before it is consumed, so the catch below
    // never sees a stream that breaks mid-way; pipe it through a pass-through
    // whose failure is logged with the submission. The reader still sees the
    // error (and a short file fails the Content-Length check).
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    void media.body?.pipeTo(writable).catch((error: unknown) => console.error(`Streaming the recording for ${who} failed`, error))
    return new Response(media.body ? readable : null, { headers })
  } catch (error) {
    console.error(`Failed to download the recording for ${who}`, error)
    return storageFailure(error) ?? Response.json({ error: "We couldn't download the recording. Try again." }, { status: 500 })
  }
}
