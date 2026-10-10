import { requireAdmin } from "@/lib/studio/admin-auth"
import { loadSubmissions, StorageError } from "@/lib/studio/submissions"

// Every face and voice recording with what was submitted alongside it, for
// /admin. Only the Studio admin account gets through; the storage rules check
// the same thing again on every read.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  try {
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
