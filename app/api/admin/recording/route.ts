import { requireAdmin } from "@/lib/studio/admin-auth"
import { storageFailure } from "@/lib/studio/admin-errors"
import { readRequestJson, type RequestJson } from "@/lib/studio/request-json"
import { StorageError } from "@/lib/studio/storage"
import { downloadName, parseSubmissionId, recordingObject, submissionFolder } from "@/lib/studio/submissions"

// One submission's original recording (?id=submissionId), or its portrait
// photo (&file=photo), as a file download. The bytes stream through here
// because the bucket serves them inline and a cross-origin link can't force a
// download.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const params = new URL(request.url).searchParams
  const who = parseSubmissionId(params.get("id"))
  if (!who) return Response.json({ error: "Unknown submission." }, { status: 400 })
  const file = params.get("file") ?? "recording"
  if (file !== "recording" && file !== "photo") return Response.json({ error: "Unknown file." }, { status: 400 })
  const folder = submissionFolder(who)

  try {
    const { items } = await admin.bucket.list(`${folder}/`)
    const object = file === "photo" ? items.find((name) => name === `${folder}/photo.jpg`) : recordingObject(items)
    if (!object) return Response.json({ error: `No ${file} in that folder.` }, { status: 404 })

    // The name only decides the file name, so a missing or broken
    // request.json falls back to "recording"; a refused read still fails the
    // whole download (it would fail the bytes too).
    const details = await admin.bucket
      .json(`${folder}/request.json`)
      .then(readRequestJson)
      .catch((error: unknown): RequestJson => {
        if (error instanceof StorageError && error.refused) throw error
        if (!(error instanceof StorageError && error.status === 404)) console.error(`Could not read request.json for ${who}`, error)
        return {}
      })

    const media = await admin.bucket.read(object)
    const headers = new Headers({
      "Content-Type": media.contentType ?? (file === "photo" ? "image/jpeg" : "video/mp4"),
      "Content-Disposition": `attachment; filename="${downloadName(details, who, object)}"`,
      "Cache-Control": "private, no-store",
    })
    if (media.length !== undefined) headers.set("Content-Length", String(media.length))

    // The body is handed back before it is consumed, so the catch below
    // never sees a stream that breaks mid-way; pipe it through a pass-through
    // whose failure is logged with the submission. The reader still sees the
    // error, and a body shorter than Content-Length is a failed download in
    // the browser. The admin cancelling the download also ends the pipe,
    // which is only worth a warning.
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    void media.body.pipeTo(writable).catch((error: unknown) => {
      const aborted = (error as { name?: string } | null)?.name === "AbortError"
      console[aborted ? "warn" : "error"](`Streaming the ${file} for ${who} ${aborted ? "was cancelled" : "failed"}`, error)
    })
    return new Response(readable, { headers })
  } catch (error) {
    console.error(`Failed to download the ${file} for ${who}`, error)
    return storageFailure(error) ?? Response.json({ error: `We couldn't download the ${file}. Try again.` }, { status: 500 })
  }
}
