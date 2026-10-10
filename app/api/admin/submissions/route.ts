import { isStudioAdmin } from "@/lib/studio/admin"
import { loadSubmissions, StorageError } from "@/lib/studio/submissions"
import { bearerToken, verifyIdToken } from "@/lib/studio/verify-id-token"

// Every face and voice recording with what was submitted alongside it, for
// /admin. Only the Studio admin account gets through; the storage rules check
// the same thing again on every read.
export async function GET(request: Request) {
  const token = bearerToken(request)
  if (!token) return Response.json({ error: "Sign in again, then retry." }, { status: 401 })

  let user
  try {
    user = await verifyIdToken(token)
  } catch {
    return Response.json({ error: "Your sign-in expired. Sign in again, then retry." }, { status: 401 })
  }
  if (!isStudioAdmin(user.email)) {
    return Response.json({ error: "This page is only for the Studio admin account." }, { status: 403 })
  }
  if (!user.emailVerified) {
    return Response.json({ error: "Verify your email first.", code: "unverified" }, { status: 403 })
  }

  try {
    return Response.json({ submissions: await loadSubmissions(token) })
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
