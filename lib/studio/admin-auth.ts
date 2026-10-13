import { isStudioAdmin, UNVERIFIED_CODE } from "@/lib/studio/admin"
import { bearerToken, verifyFailure, verifyIdToken, type VerifiedUser } from "@/lib/studio/verify-id-token"

/** The verified admin and the token they sent; the storage reads reuse that token, so the rules check the admin again on every object. */
export type AdminSession = { user: VerifiedUser; token: string }

// Every /api/admin route starts here. Returns the session, or the Response to
// send back (a route that forgets the `instanceof Response` branch doesn't
// compile: a Response has no `.token`).
export async function requireAdmin(request: Request): Promise<AdminSession | Response> {
  const token = bearerToken(request)
  if (!token) return Response.json({ error: "Sign in again, then retry." }, { status: 401 })
  let user: VerifiedUser
  try {
    user = await verifyIdToken(token)
  } catch (error) {
    const failure = verifyFailure(error)
    if (failure.kind !== "expired") console.error("verifyIdToken failed", error)
    return Response.json({ error: failure.message }, { status: failure.status })
  }
  // The admin check comes first, so a non-admin never learns there is a
  // verification step.
  if (!isStudioAdmin(user.email)) {
    return Response.json({ error: "This page is only for the Studio admin account." }, { status: 403 })
  }
  if (!user.emailVerified) {
    return Response.json({ error: "Verify your email first.", code: UNVERIFIED_CODE }, { status: 403 })
  }
  return { user, token }
}
