import { parseAttribution } from "@/lib/attribution"
import { sendPlaybookEmail } from "@/lib/playbook-mail"
import { EMAIL_PATTERN, INVALID_EMAIL_MESSAGE } from "@/lib/waitlist"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }
  const input = body as { email?: unknown; attribution?: unknown } | null
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : ""
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: INVALID_EMAIL_MESSAGE }, { status: 400 })
  }
  try {
    await sendPlaybookEmail(email, new URL(request.url).origin, parseAttribution(input?.attribution))
  } catch (error) {
    console.error("Failed to email the Video Playbook", error)
    return Response.json({ error: "We couldn't send the playbook. Please try again." }, { status: 500 })
  }
  return Response.json({ ok: true })
}
