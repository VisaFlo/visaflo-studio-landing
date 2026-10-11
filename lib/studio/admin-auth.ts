import { isStudioAdmin } from "@/lib/studio/admin"
import { bearerToken, verifyIdToken, type VerifiedUser } from "@/lib/studio/verify-id-token"

// Every /api/admin route starts here. Returns the verified admin and their
// token, or the Response to send back.
export async function requireAdmin(request: Request): Promise<{ user: VerifiedUser; token: string } | Response> {
  const token = bearerToken(request)
  if (!token) return Response.json({ error: "Sign in again, then retry." }, { status: 401 })
  let user: VerifiedUser
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
  return { user, token }
}
