import { requireAdmin } from "@/lib/studio/admin-auth"
import { storageFailure } from "@/lib/studio/admin-errors"
import { StorageError } from "@/lib/studio/storage"
import { loadSubmission, loadSubmissions, parseSubmissionId, submissionFolder } from "@/lib/studio/submissions"

// Every face and voice recording with what was submitted alongside it, for
// /admin — or one of them with ?id=submissionId for its page. Only a
// VisaFlo master gets through (lib/studio/admin-auth.ts).
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const id = new URL(request.url).searchParams.get("id")
  try {
    if (id !== null) {
      const submissionId = parseSubmissionId(id)
      if (!submissionId) return Response.json({ error: "Unknown submission." }, { status: 400 })
      const submission = await loadSubmission(admin.bucket, submissionId)
      if (!submission) return Response.json({ error: "No such submission." }, { status: 404 })
      // A folder with problems (say, the recording is gone) still comes back
      // whole, so the page can show what is there and what isn't.
      return Response.json({ submission })
    }
    return Response.json({ submissions: await loadSubmissions(admin.bucket) })
  } catch (error) {
    console.error(id !== null ? `Failed to load Studio submission ${id}` : "Failed to list Studio submissions", error)
    return storageFailure(error) ?? Response.json({ error: "We couldn't load the submissions. Reload to try again." }, { status: 500 })
  }
}

// Deletes one submission for good (?id=submissionId): every object in its
// folder, the recording and request.json alike. Each object is tried even
// when another fails, and the answer names what is still there, so a retry
// finishes the job. An object already gone counts as deleted.
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const id = new URL(request.url).searchParams.get("id")
  const submissionId = parseSubmissionId(id)
  if (!submissionId) return Response.json({ error: "Unknown submission." }, { status: 400 })
  const folder = submissionFolder(submissionId)

  try {
    const { items } = await admin.bucket.list(`${folder}/`)
    if (!items.length) return Response.json({ error: "No such submission." }, { status: 404 })

    const results = await Promise.allSettled(items.map((name) => admin.bucket.remove(name)))
    const failed = items.flatMap((name, i) => {
      const result = results[i]
      if (result.status === "fulfilled") return []
      if (result.reason instanceof StorageError && result.reason.status === 404) return []
      console.error(`Could not delete ${name}`, result.reason)
      return [{ name, error: result.reason as unknown }]
    })
    if (!failed.length) {
      console.info(`${admin.user.uid} deleted Studio submission ${submissionId} (${items.length} files)`)
      return Response.json({ deleted: items.length })
    }
    // Nothing went and the account itself was refused: that message, not a file list.
    const refused = failed.length === items.length ? storageFailure(failed[0].error) : null
    if (refused) return refused
    const left = failed.map((f) => f.name.slice(folder.length + 1)).join(", ")
    return Response.json({ error: `We deleted ${items.length - failed.length} of ${items.length} files. Still there: ${left}. Try again.` }, { status: 500 })
  } catch (error) {
    console.error(`Failed to delete Studio submission ${id}`, error)
    return storageFailure(error) ?? Response.json({ error: "We couldn't delete the submission. Try again." }, { status: 500 })
  }
}
