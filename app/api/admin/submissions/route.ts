import { requireAdmin } from "@/lib/studio/admin-auth"
import { loadSubmission, loadSubmissions, parseSubmissionId, StorageError } from "@/lib/studio/submissions"

// Every face and voice recording with what was submitted alongside it, for
// /admin — or one of them with ?id=uid/submissionId for its page. Only the
// Studio admin account gets through; the storage rules check the same thing
// again on every read.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const id = new URL(request.url).searchParams.get("id")
  try {
    if (id) {
      const ref = parseSubmissionId(id)
      if (!ref) return Response.json({ error: "Unknown submission." }, { status: 400 })
      const submission = await loadSubmission(admin.token, ref.uid, ref.submissionId)
      if (!submission.video && submission.problem?.includes("no recording file")) {
        return Response.json({ error: "No recording in that folder." }, { status: 404 })
      }
      return Response.json({ submission })
    }
    return Response.json({ submissions: await loadSubmissions(admin.token) })
  } catch (error) {
    console.error("Failed to list Studio submissions", error)
    if (error instanceof StorageError && (error.status === 401 || error.status === 403)) {
      return Response.json(
        { error: "Storage refused the read. Publish the latest docs/studio-capture/storage.rules, then reload." },
        { status: 502 },
      )
    }
    return Response.json({ error: "We couldn't load the submissions. Reload to try again." }, { status: 500 })
  }
}
