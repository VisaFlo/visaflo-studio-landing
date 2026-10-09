import { ATTRIBUTION_PARAMS, type Attribution, type Touch } from "@/lib/attribution"
import { escapeHtml, sendMail, TEAM_INBOX } from "@/lib/sendgrid"
import type { WaitlistEntry } from "@/lib/waitlist"

// Every signup is emailed to the team inbox. Nothing is stored on this side.
// Fixed subject so the inbox can filter and count signups.
export const SUBJECT = "[VisaFlo Studio] New waitlist signup"

// Where an email sends someone to record their face and voice. The channel
// that brought them carries over so the sign-up is credited to it. Their
// email stays out of the URL: page URLs go to GA and Mixpanel.
export function recordLink(origin: string, attribution?: Attribution): string {
  const url = new URL("/signin", origin)
  const touch = attribution?.last ?? attribution?.first
  for (const key of ATTRIBUTION_PARAMS) {
    if (touch?.[key]) url.searchParams.set(key, touch[key])
  }
  return url.toString()
}

// The closing pitch in the chart and playbook emails.
export function recordPitch(link: string) {
  const lead = "VisaFlo Studio makes immigration videos in your own face and voice, from IRCC's own announcements. Record your face and voice (about 3 minutes) and pick a topic, and we'll make a sample video and email it to you."
  return {
    text: `${lead}\n${link}`,
    html: `<p style="margin:24px 0 16px">${escapeHtml(lead)}</p>
      <p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="color:#0c0a09;font-weight:600">Record your face and voice</a></p>`,
  }
}

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

function describeTouch(touch: Touch): string {
  const channel = [touch.utm_source, touch.utm_medium].filter(Boolean).join(" / ")
  const parts = [
    channel || (touch.referrer ? `referral: ${touch.referrer}` : "direct / unknown"),
    touch.utm_campaign && `campaign: ${touch.utm_campaign}`,
    touch.utm_content && `content: ${touch.utm_content}`,
    touch.landing && touch.landing !== "/" && `page: ${touch.landing}`,
  ]
  return parts.filter(Boolean).join(", ")
}

// Which channel brought this lead in: the latest tagged visit if there was
// one, else the first visit. The first visit is listed too when it differs.
export function attributionRows(attribution?: Attribution): [string, string][] {
  const { first, last } = attribution ?? {}
  const latest = last ?? first
  if (!latest) return [["Came from", "unknown (no tracking data)"]]
  const rows: [string, string][] = [["Came from", describeTouch(latest)]]
  const cid = latest.cid ?? first?.cid
  if (cid) rows.push(["Customer ID (cid)", cid])
  if (first && last && first.at !== last.at) {
    rows.push(["First visit", `${describeTouch(first)}${first.at ? ` (${vancouverTime(new Date(first.at))})` : ""}`])
  }
  return rows
}

// The person who asked for a sample: the next step is recording their face
// and voice, which we make the sample from.
async function sendRecordInvite(entry: WaitlistEntry, link: string): Promise<void> {
  const firstName = entry.name?.split(/\s+/)[0]
  const greeting = firstName ? `Hi ${firstName},` : "Hi,"
  const steps = [
    "Thanks for asking for a sample video. To make it in your own face and voice, we need a short recording of you.",
    "It takes about 3 minutes: fit your face in a circle, slowly turn your head, then read a short script out loud. Then pick a topic, and we'll make your sample and email it to you.",
  ]
  const account = `Sign in with your VisaFlo email and password, or choose Create an account and use ${entry.email}.`
  const tips = [
    "A computer with a webcam or your phone both work",
    "If the camera doesn't start, open the link in Chrome or Safari",
    "Face a window or lamp, in a quiet room",
  ]
  await sendMail({
    to: entry.email,
    subject: "Next step for your VisaFlo sample video",
    text: `${greeting}\n\n${steps.join("\n\n")}\n\nRecord your face and voice: ${link}\n\n${account}\n\n${tips.map((t) => `- ${t}`).join("\n")}\n\n— VisaFlo Studio`,
    html: `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#0c0a09;max-width:560px">
      <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
      ${steps.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join("")}
      <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0c0a09;color:#fff;padding:12px 20px;text-decoration:none;font-weight:600">Record your face and voice</a></p>
      <p style="margin:0 0 16px;color:#57534e">${escapeHtml(account)}</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#57534e">${tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      <p style="color:#57534e">— VisaFlo Studio</p>
    </div>`,
  })
}

export async function sendWaitlistEmail(entry: WaitlistEntry, origin: string): Promise<void> {
  const link = recordLink(origin, entry.attribution)
  // The team notice is the only record of the signup, so it must go out even
  // when the invite fails; it says so, and the team sends the link by hand.
  let invite = `Sent to ${entry.email}`
  try {
    await sendRecordInvite(entry, link)
  } catch (error) {
    console.error("Sample request saved, but the recording invite failed", error)
    invite = `NOT SENT (email failed). Send them ${link}`
  }

  const { text, html } = detailsTable([
    ["Firm name", entry.firm ?? "—"],
    ["Your name", entry.name ?? "—"],
    ["Email", entry.email],
    ["Submitted from", SOURCE_LABEL[entry.source]],
    ["Recording invite", invite],
    ...attributionRows(entry.attribution),
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
