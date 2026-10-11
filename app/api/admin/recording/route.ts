import { requireAdmin } from "@/lib/studio/admin-auth"
import { listObjects, storageGet } from "@/lib/studio/storage"
import { downloadName, parseSubmissionId, recordingObject, StorageError } from "@/lib/studio/submissions"

type RequestJson = { name?: string; email?: string }

// One submission's original recording as a file download
// (?id=uid/submissionId). The bytes stream through here because the bucket
// serves them inline and a cross-origin link can't force a download; the
// admin's own ID token is what reads the object, so the storage rules decide.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const ref = parseSubmissionId(new URL(request.url).searchParams.get("id"))
  if (!ref) return Response.json({ error: "Unknown submission." }, { status: 400 })
  const folder = `studio/${ref.uid}/${ref.submissionId}`

  try {
    const { items } = await listObjects(admin.token, `${folder}/`)
    const recording = recordingObject(items)
    if (!recording) return Response.json({ error: "No recording in that folder." }, { status: 404 })
    const details = await storageGet(admin.token, `/${encodeURIComponent(`${folder}/request.json`)}?alt=media`)
      .then((r) => r.json() as Promise<RequestJson>)
      .catch(() => ({}) as RequestJson)

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
    console.error("Failed to download a Studio recording", error)
    if (error instanceof StorageError && (error.status === 401 || error.status === 403)) {
      return Response.json(
        { error: "Storage refused the read. Publish the latest docs/studio-capture/storage.rules, then reload." },
        { status: 502 },
      )
    }
    return Response.json({ error: "We couldn't download the recording. Try again." }, { status: 500 })
  }
}
