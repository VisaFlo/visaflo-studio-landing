import { escapeHtml, sendMail, TEAM_INBOX } from "@/lib/sendgrid"
import type { WaitlistEntry } from "@/lib/waitlist"

// Every signup is emailed to the team inbox. Nothing is stored on this side.
// Fixed subject so the inbox can filter and count signups.
export const SUBJECT = "[VisaFlo Studio] New waitlist signup"

const SOURCE_LABEL: Record<WaitlistEntry["source"], string> = {
  hero: "Hero form (top of page)",
  waitlist: "Waitlist form (bottom of page)",
}

export function vancouverTime(at: Date): string {
  return at.toLocaleString("en-CA", { timeZone: "America/Vancouver", dateStyle: "medium", timeStyle: "short" }) + " (Vancouver)"
}

export function detailsTable(rows: [string, string][]) {
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n")
  const html = `<table style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#57534e;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`)
    .join("")}</table>`
  return { text, html }
}

export async function sendWaitlistEmail(entry: WaitlistEntry): Promise<void> {
  const { text, html } = detailsTable([
    ["Firm name", entry.firm ?? "—"],
    ["Your name", entry.name ?? "—"],
    ["Email", entry.email],
    ["Submitted from", SOURCE_LABEL[entry.source]],
    ["Time", vancouverTime(new Date())],
  ])
  await sendMail({
    to: TEAM_INBOX,
    subject: SUBJECT,
    text,
    html,
    // Replying in the inbox goes straight to the person who signed up.
    replyTo: { email: entry.email, name: entry.name },
  })
}
