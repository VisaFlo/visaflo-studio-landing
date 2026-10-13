import { isStudioAdmin } from "@/lib/studio/admin"
import { bearerToken, verifyFailure, verifyIdToken, type VerifiedUser } from "@/lib/studio/verify-id-token"

// Every /api/admin route starts here. Returns the verified admin and their
// token (the storage reads use that same token, so the rules check the
// admin again on every object), or the Response to send back.
export async function requireAdmin(request: Request): Promise<{ user: VerifiedUser; token: string } | Response> {
  const token = bearerToken(request)
  if (!token) return Response.json({ error: "Sign in again, then retry." }, { status: 401 })
  let user: VerifiedUser
  try {
    user = await verifyIdToken(token)
  } catch (error) {
    const failure = verifyFailure(error)
    if (failure.status !== 401 || (error as { code?: string }).code !== "ERR_JWT_EXPIRED") console.error("verifyIdToken failed", error)
    return Response.json({ error: failure.message }, { status: failure.status })
  }
  // The admin check comes first, so a non-admin never learns there is a
  // verification step.
  if (!isStudioAdmin(user.email)) {
    return Response.json({ error: "This page is only for the Studio admin account." }, { status: 403 })
  }
  // `code: "unverified"` is what the admin pages key on to show the
  // "Send verification email" panel instead of an error.
  if (!user.emailVerified) {
    return Response.json({ error: "Verify your email first.", code: "unverified" }, { status: 403 })
  }
  return { user, token }
}
