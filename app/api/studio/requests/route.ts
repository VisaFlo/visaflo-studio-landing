import { sendStudioRequestEmail } from "@/lib/studio-request-mail"
import { bearerToken, verifyIdToken } from "@/lib/studio/verify-id-token"

const MAX_TEXT = 200

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

// A signed-in person finished recording and picked a topic. The files are
// already in the bucket; this tells the team. The uid comes from the verified
// token, never the body, and the recording must sit under that uid's folder.
export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) return Response.json({ error: "Sign in again, then retry." }, { status: 401 })

  let user
  try {
    user = await verifyIdToken(token)
  } catch {
    return Response.json({ error: "Your sign-in expired. Sign in again, then retry." }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }

  const submissionId = text(body.submissionId, 64)
  const recordingPath = text(body.recordingPath, 300)
  if (!/^[\w-]+$/.test(submissionId) || !recordingPath.startsWith(`studio/${user.uid}/${submissionId}/`)) {
    return Response.json({ error: "That recording doesn't belong to this account." }, { status: 400 })
  }
  const topicTitle = text(body.topicTitle, 500)
  if (!topicTitle) return Response.json({ error: "Pick a topic first." }, { status: 400 })
  const consentAt = text(body.consentAt, 40)
  if (!consentAt || Number.isNaN(Date.parse(consentAt))) {
    return Response.json({ error: "Agree to the consent first." }, { status: 400 })
  }

  const rawChecks = body.checks as Record<string, unknown> | undefined
  try {
    await sendStudioRequestEmail({
      uid: user.uid,
      email: user.email ?? "unknown",
      name: text(body.name),
      firm: text(body.firm),
      topicTitle,
      submissionId,
      recordingPath,
      recordingSeconds: Math.max(0, Math.round(Number(body.recordingSeconds) || 0)),
      recordingSource: body.recordingSource === "upload" ? "upload" : "camera",
      checks: rawChecks
        ? {
            faceSeen: rawChecks.faceSeen === true,
            voiceHeard: rawChecks.voiceHeard === true,
            headTurn: rawChecks.headTurn === true,
          }
        : undefined,
      consentAt,
    })
  } catch (error) {
    console.error("Failed to email studio request", error)
    return Response.json({ error: "We saved your recording but couldn't send the request. Try again." }, { status: 500 })
  }

  return Response.json({ ok: true })
}
