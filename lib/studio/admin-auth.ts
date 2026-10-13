import { AdminConfigError, studioAdmin } from "@/lib/studio/admin-firebase"
import type { StudioBucket } from "@/lib/studio/storage"
import { bearerToken, verifyFailure, verifyIdToken, type VerifiedUser } from "@/lib/studio/verify-id-token"

/** The verified master and the bucket the server reads for them (with its service account, so this check is the only gate). */
export type AdminSession = { user: VerifiedUser; bucket: StudioBucket }

// Every /api/admin route starts here. Returns the session, or the Response to
// send back (a route that forgets the `instanceof Response` branch doesn't
// compile: a Response has no `.bucket`). Who gets in is whoever VisaFlo
// marked as a master on their users doc (lib/studio/admin-firebase.ts).
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

  let admin
  try {
    admin = studioAdmin()
  } catch (error) {
    console.error("The admin service account isn't usable", error)
    const detail = error instanceof AdminConfigError ? `: ${error.message}` : "."
    return Response.json({ error: `The admin pages aren't set up on this server${detail}` }, { status: 500 })
  }

  let master: boolean
  try {
    master = await admin.isMaster(user.uid)
  } catch (error) {
    console.error(`Could not read the profile of ${user.uid}`, error)
    return Response.json({ error: "We couldn't check your account right now. Try again in a minute." }, { status: 503 })
  }
  if (!master) return Response.json({ error: "This page is only for VisaFlo master accounts." }, { status: 403 })
  return { user, bucket: admin.bucket }
}
