import { readFile } from "node:fs/promises"
import path from "node:path"

import { ATTRIBUTION_PARAMS, type Attribution } from "@/lib/attribution"
import { PLAYBOOK_EDITION, PLAYBOOK_FILES, PLAYBOOK_TITLE } from "@/lib/playbook"
import { escapeHtml, sendMail, TEAM_INBOX } from "@/lib/sendgrid"
import { attributionRows, detailsTable, vancouverTime } from "@/lib/waitlist-mail"

export async function sendPlaybookEmail(email: string, attribution?: Attribution): Promise<void> {
  const sampleUrl = new URL("https://studio.visaflo.ca/")
  const touch = attribution?.last ?? attribution?.first
  for (const key of ATTRIBUTION_PARAMS) {
    if (touch?.[key]) sampleUrl.searchParams.set(key, touch[key])
  }
  sampleUrl.hash = "waitlist"
  const sampleLink = sampleUrl.toString()
  const attachments = await Promise.all(PLAYBOOK_FILES.map(async ({ file, filename, type }) => ({
    filename,
    type,
    content: (await readFile(path.join(process.cwd(), "assets", file))).toString("base64"),
  })))
  const paragraphs = [
    "Your Video Playbook is attached: nine formats with practical openings, four-screen filming blueprints and a planning sheet for your next immigration video.",
    "We collected 7,558 recent upload records from 50 immigration channels and reviewed 179 title and thumbnail examples. The research kit includes the channel rankings, selected examples and a searchable research library.",
    "Start with the question you heard in your last consultation. Pick a format, write your opening and use the planning sheet to build your brief.",
  ]
  await sendMail({
    to: email,
    subject: `Your VisaFlo Studio Video Playbook | ${PLAYBOOK_EDITION}`,
    text: `${PLAYBOOK_TITLE}\n${PLAYBOOK_EDITION}\n\n${paragraphs.join("\n\n")}\n\nWant a video in your own face and voice? Get your Studio sample: ${sampleLink}\n\n— VisaFlo Studio`,
    html: `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#0c0a09;max-width:560px">
      <h1 style="font:600 26px/1.2 Georgia,serif;margin:0 0 8px">${escapeHtml(PLAYBOOK_TITLE)}</h1>
      <p style="margin:0 0 24px;color:#57534e">${PLAYBOOK_EDITION}</p>
      ${paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join("")}
      <p style="margin:24px 0 16px">Want a video in your own face and voice? <a href="${escapeHtml(sampleLink)}" style="color:#0c0a09">Get your Studio sample</a>.</p>
      <p style="color:#57534e">— VisaFlo Studio</p>
    </div>`,
    attachments,
  })

  const notice = detailsTable([
    ["Email", email], ["Requested", PLAYBOOK_TITLE], ["Edition", PLAYBOOK_EDITION],
    ...attributionRows(attribution), ["Time", vancouverTime(new Date())],
  ])
  // A team-notice failure must not tell the reader their delivered PDF failed.
  try {
    await sendMail({ to: TEAM_INBOX, subject: "[VisaFlo Studio] Video Playbook requested", text: notice.text, html: notice.html, replyTo: { email } })
  } catch (error) {
    console.error("Video Playbook delivered, but team notice failed", error)
  }
}
