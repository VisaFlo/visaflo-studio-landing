import { readFile } from "node:fs/promises"
import path from "node:path"

import type { Attribution } from "@/lib/attribution"
import { escapeHtml, sendMail, TEAM_INBOX } from "@/lib/sendgrid"
import { CHART_DATA_DATE } from "@/lib/top50"
import { attributionRows, detailsTable, vancouverTime } from "@/lib/waitlist-mail"

// The ranking graphics live outside public/ so they are only handed out by
// email. next.config.ts traces assets/ into the /api/top50 function bundle.
const CHARTS = [
  { file: "top50-subscribers.png", filename: "VisaFlo-Top-50-RCICs-on-YouTube-by-subscribers.png" },
  { file: "top50-views.png", filename: "VisaFlo-Top-50-RCICs-on-YouTube-by-views.png" },
]

export const CHART_TITLE = "Top 50 RCICs & Immigration Lawyers on YouTube"

export async function sendTop50Email(email: string, siteUrl: string, attribution?: Attribution): Promise<void> {
  const attachments = await Promise.all(
    CHARTS.map(async ({ file, filename }) => ({
      filename,
      type: "image/png",
      content: (await readFile(path.join(process.cwd(), "assets", file))).toString("base64"),
    }))
  )

  const paragraphs = [
    "Here is the ranking you asked for: the 50 licensed RCICs and immigration lawyers with the biggest YouTube audiences. Two charts are attached, one ranked by subscribers and one ranked by views on videos posted in the last 12 months.",
    `Public YouTube counts were measured on ${CHART_DATA_DATE}. Every channel is run by a licensee or their firm, checked against the CICC register and law society directories, and posted a video in the last 12 months.`,
    "A bigger audience does not mean better advice. But explaining immigration clearly, week after week, to this many people takes real work.",
    `VisaFlo Studio makes this kind of video for you, in your own face and voice, from IRCC's own announcements. Early access: ${siteUrl}`,
  ]
  const text = `${CHART_TITLE}\n\n${paragraphs.join("\n\n")}\n\n— VisaFlo`
  const html = `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#0c0a09;max-width:560px">
    <h1 style="font:600 22px/1.2 Georgia,serif;margin:0 0 20px">${escapeHtml(CHART_TITLE)}</h1>
    ${paragraphs.slice(0, 3).map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join("")}
    <p style="margin:0 0 16px">VisaFlo Studio makes this kind of video for you, in your own face and voice, from IRCC&#39;s own announcements. <a href="${escapeHtml(siteUrl)}" style="color:#0c0a09">Get early access</a>.</p>
    <p style="margin:24px 0 0;color:#57534e">— VisaFlo</p>
  </div>`

  await sendMail({
    to: email,
    subject: CHART_TITLE,
    text,
    html,
    attachments,
  })

  // The team gets a lead notice with a fixed subject, like waitlist signups.
  const notice = detailsTable([
    ["Email", email],
    ["Requested", CHART_TITLE],
    ...attributionRows(attribution),
    ["Time", vancouverTime(new Date())],
  ])
  await sendMail({
    to: TEAM_INBOX,
    subject: "[VisaFlo Studio] Top 50 chart requested",
    text: notice.text,
    html: notice.html,
    replyTo: { email },
  })
}
