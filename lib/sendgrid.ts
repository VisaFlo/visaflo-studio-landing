// Thin wrapper over SendGrid's REST API. The account and verified sender are
// the ones the VisaFlo backend already uses, so no SDK or extra setup.
export const FROM = { email: "info@vflo.app", name: "VisaFlo Studio" }
export const TEAM_INBOX = process.env.WAITLIST_TO ?? "info@vflo.app"

export type Attachment = {
  filename: string
  type: string
  /** Base64-encoded file contents. */
  content: string
}

export type Mail = {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: { email: string; name?: string }
  attachments?: Attachment[]
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY

  if (!apiKey) {
    // Local development without the key: show the email instead of sending it.
    // In production a missing key must fail loudly, or signups vanish silently.
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mail] SENDGRID_API_KEY not set; would email ${mail.to}:\n${mail.subject}\n${mail.text}`)
      return
    }
    throw new Error("SENDGRID_API_KEY is not set")
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: mail.to }] }],
      from: FROM,
      reply_to: mail.replyTo,
      subject: mail.subject,
      content: [
        { type: "text/plain", value: mail.text },
        { type: "text/html", value: mail.html },
      ],
      attachments: mail.attachments,
    }),
  })
  if (!response.ok) {
    throw new Error(`SendGrid responded ${response.status}: ${(await response.text()).slice(0, 500)}`)
  }
}
