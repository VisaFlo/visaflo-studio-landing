import { requireAdmin } from "@/lib/studio/admin-auth"
import { storageFailure } from "@/lib/studio/admin-errors"
import { loadSubmission, loadSubmissions, parseSubmissionId } from "@/lib/studio/submissions"

// Every face and voice recording with what was submitted alongside it, for
// /admin — or one of them with ?id=uid/submissionId for its page. Only the
// Studio admin account gets through; the storage rules check the same thing
// again on every read.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const id = new URL(request.url).searchParams.get("id")
  try {
    if (id !== null) {
      const ref = parseSubmissionId(id)
      if (!ref) return Response.json({ error: "Unknown submission." }, { status: 400 })
      const submission = await loadSubmission(admin.token, ref)
      if (!submission) return Response.json({ error: "No such submission." }, { status: 404 })
      // A folder with problems (say, the recording is gone) still comes back
      // whole, so the page can show what is there and what isn't.
      return Response.json({ submission })
    }
    return Response.json({ submissions: await loadSubmissions(admin.token) })
  } catch (error) {
    console.error(id !== null ? `Failed to load Studio submission ${id}` : "Failed to list Studio submissions", error)
    return storageFailure(error) ?? Response.json({ error: "We couldn't load the submissions. Reload to try again." }, { status: 500 })
  }
}
