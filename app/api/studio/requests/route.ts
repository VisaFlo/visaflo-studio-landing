import { sendStudioRequestEmail } from "@/lib/studio-request-mail"
import { parseChecks } from "@/lib/studio/checks"
import { RECORDING_EXTENSIONS } from "@/lib/studio/project"
import { identifier, isoDate, LIMITS, seconds, text } from "@/lib/studio/request-json"
import { bearerToken, verifyFailure, verifyIdToken } from "@/lib/studio/verify-id-token"

const RECORDING_FILE = new RegExp(`^recording\\.(${RECORDING_EXTENSIONS.join("|")})$`)

// A signed-in person finished recording and picked a topic. The files are
// already in the bucket; this tells the team. The uid comes from the verified
// token, never the body, and the recording must sit under that uid's folder.
export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) return Response.json({ error: "Sign in again, then retry." }, { status: 401 })

  let user
  try {
    user = await verifyIdToken(token)
  } catch (error) {
    const failure = verifyFailure(error)
    if (failure.kind !== "expired") console.error("verifyIdToken failed", error)
    return Response.json({ error: failure.message }, { status: failure.status })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch (error) {
    console.error(`Unreadable request body from ${user.uid}`, error)
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }

  const submissionId = identifier(body.submissionId, LIMITS.submissionId) ?? ""
  const recordingPath = identifier(body.recordingPath, LIMITS.recordingPath) ?? ""
  const folder = `studio/${user.uid}/${submissionId}/`
  const validPath = /^[\w-]+$/.test(submissionId) && recordingPath.startsWith(folder) && RECORDING_FILE.test(recordingPath.slice(folder.length))
  if (!validPath) {
    // Our own client never sends this, so it is a client bug or someone probing.
    console.error(`Rejected a recording path from ${user.uid}`, { submissionId: body.submissionId, recordingPath: body.recordingPath })
    return Response.json({ error: "That recording doesn't belong to this account." }, { status: 400 })
  }
  // The client sends these only once they are set, so a refusal here is a
  // client bug worth a line too.
  const topicTitle = text(body.topicTitle, LIMITS.topicTitle)
  if (!topicTitle) {
    console.error(`Rejected a request from ${user.uid}: no topic`, { topicTitle: body.topicTitle })
    return Response.json({ error: "Pick a topic first." }, { status: 400 })
  }
  const consentAt = isoDate(body.consentAt)
  if (!consentAt) {
    console.error(`Rejected a request from ${user.uid}: bad consent time`, { consentAt: body.consentAt })
    return Response.json({ error: "Agree to the consent first." }, { status: 400 })
  }

  try {
    await sendStudioRequestEmail({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      name: text(body.name) ?? "",
      firm: text(body.firm) ?? "",
      topicTitle,
      submissionId,
      recordingPath,
      recordingSeconds: seconds(body.recordingSeconds) ?? 0,
      recordingSource: "camera",
      checks: parseChecks(body.checks),
      consentAt,
    })
  } catch (error) {
    console.error("Failed to email studio request", error)
    return Response.json({ error: "We saved your recording but couldn't send the request. Try again." }, { status: 500 })
  }

  return Response.json({ ok: true })
}
