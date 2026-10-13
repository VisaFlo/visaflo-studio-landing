import { requireAdmin } from "@/lib/studio/admin-auth"
import { storageFailure } from "@/lib/studio/admin-errors"
import { listObjects, storageGet, storageJson, StorageError } from "@/lib/studio/storage"
import { downloadName, parseSubmissionId, readRequestJson, recordingObject, submissionFolder, type RequestJson } from "@/lib/studio/submissions"

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
        if (error instanceof StorageError && (error.status === 401 || error.status === 403)) throw error
        if (!(error instanceof StorageError && error.status === 404)) console.error(`Could not read request.json for ${ref.uid}/${ref.submissionId}`, error)
        return {}
      })

    const media = await storageGet(admin.token, `/${encodeURIComponent(recording)}?alt=media`)
    const headers = new Headers({
      "Content-Type": media.headers.get("content-type") ?? "video/mp4",
      "Content-Disposition": `attachment; filename="${downloadName({ ...details, uid: ref.uid, submissionId: ref.submissionId }, recording)}"`,
      "Cache-Control": "private, no-store",
    })
    const length = media.headers.get("content-length")
    if (length) headers.set("Content-Length", length)
    return new Response(media.body, { headers })
  } catch (error) {
    console.error(`Failed to download the recording for ${ref.uid}/${ref.submissionId}`, error)
    return storageFailure(error) ?? Response.json({ error: "We couldn't download the recording. Try again." }, { status: 500 })
  }
}
