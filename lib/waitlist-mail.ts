import type { WaitlistEntry } from "@/lib/waitlist"

// Every signup is emailed to the team inbox through SendGrid, the same account
// and verified sender the VisaFlo backend uses. Nothing is stored on this side.
const TO = process.env.WAITLIST_TO ?? "info@vflo.app"
const FROM = { email: "info@vflo.app", name: "VisaFlo Studio" }
// Fixed subject so the inbox can filter and count signups.
export const SUBJECT = "[VisaFlo Studio] New waitlist signup"

const SOURCE_LABEL: Record<WaitlistEntry["source"], string> = {
  hero: "Hero form (top of page)",
  waitlist: "Waitlist form (bottom of page)",
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

function buildMessage(entry: WaitlistEntry, at: Date) {
  const rows: [string, string][] = [
    ["Firm name", entry.firm ?? "—"],
    ["Your name", entry.name ?? "—"],
    ["Email", entry.email],
    ["Submitted from", SOURCE_LABEL[entry.source]],
    ["Time", at.toLocaleString("en-CA", { timeZone: "America/Vancouver", dateStyle: "medium", timeStyle: "short" }) + " (Vancouver)"],
  ]
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n")
  const html = `<table style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#57534e;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`)
    .join("")}</table>`
  return { text, html }
}

export async function sendWaitlistEmail(entry: WaitlistEntry): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  const { text, html } = buildMessage(entry, new Date())

  if (!apiKey) {
    // Local development without the key: show the email instead of sending it.
    // In production a missing key must fail loudly, or signups vanish silently.
    if (process.env.NODE_ENV !== "production") {
      console.info(`[waitlist] SENDGRID_API_KEY not set; would email ${TO}:\n${SUBJECT}\n${text}`)
      return
    }
    throw new Error("SENDGRID_API_KEY is not set")
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: TO }] }],
      from: FROM,
      // Replying in the inbox goes straight to the person who signed up.
      reply_to: { email: entry.email, name: entry.name },
      subject: SUBJECT,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`SendGrid responded ${response.status}: ${(await response.text()).slice(0, 500)}`)
  }
}
