import { escapeHtml, sendMail, TEAM_INBOX } from "@/lib/sendgrid"
import { describeChecks, type RecordingChecks } from "@/lib/studio/checks"
import { BUCKET } from "@/lib/studio/project"
import { consoleUrl } from "@/lib/studio/storage"
import { detailsTable, vancouverTime } from "@/lib/waitlist-mail"

// One email per finished recording, to the same inbox as waitlist signups.
// Fixed subject so the inbox can filter and count them.
export const SUBJECT = "[VisaFlo Studio] New sample recording"

export type StudioRequestMail = {
  uid: string
  email: string
  /** False for a new Studio account: anyone can sign up with any address. */
  emailVerified: boolean
  name: string
  firm: string
  topicTitle: string
  submissionId: string
  recordingPath: string
  recordingSeconds: number
  recordingSource: "camera" | "upload"
  checks?: RecordingChecks
  consentAt: string
}

function minutes(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export async function sendStudioRequestEmail(entry: StudioRequestMail): Promise<void> {
  const folder = entry.recordingPath.slice(0, entry.recordingPath.lastIndexOf("/"))
  const folderUrl = consoleUrl(folder)
  const checks = entry.checks ? describeChecks(entry.checks) : "uploaded file, not checked"

  const { text, html } = detailsTable([
    ["Firm name", entry.firm || "—"],
    ["Name", entry.name || "—"],
    ["Email", entry.emailVerified ? entry.email : `${entry.email} (not verified: new account, confirm before using their face)`],
    ["Topic", entry.topicTitle],
    ["Recording", `${minutes(entry.recordingSeconds)} (${entry.recordingSource}), ${checks}`],
    ["File", `gs://${BUCKET}/${entry.recordingPath}`],
    ["Consent", `Agreed ${vancouverTime(new Date(entry.consentAt))}`],
    ["VisaFlo uid", entry.uid],
    ["Time", vancouverTime(new Date())],
  ])

  await sendMail({
    to: TEAM_INBOX,
    subject: SUBJECT,
    text: `${text}\n\nOpen the folder: ${folderUrl}`,
    html: `${html}<p style="font:15px/1.5 -apple-system,Segoe UI,sans-serif"><a href="${escapeHtml(folderUrl)}">Open the folder in Firebase</a></p>`,
    replyTo: { email: entry.email, name: entry.name || undefined },
  })
}
