import { escapeHtml, sendMail, TEAM_INBOX } from "@/lib/sendgrid"
import { detailsTable, vancouverTime } from "@/lib/waitlist-mail"

// One email per finished recording, to the same inbox as waitlist signups.
// Fixed subject so the inbox can filter and count them.
export const SUBJECT = "[VisaFlo Studio] New sample recording"

const BUCKET = "devdashboard-c9159-ca"

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
  checks?: { faceSeen: boolean; voiceHeard: boolean; headTurn: boolean }
  consentAt: string
}

function minutes(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export async function sendStudioRequestEmail(entry: StudioRequestMail): Promise<void> {
  const folder = entry.recordingPath.slice(0, entry.recordingPath.lastIndexOf("/"))
  const consoleUrl = `https://console.firebase.google.com/project/devdashboard-c9159/storage/${BUCKET}/files/~2F${folder
    .split("/")
    .join("~2F")}`
  const checks = entry.checks
    ? [
        entry.checks.faceSeen ? "face seen" : "NO FACE SEEN",
        entry.checks.voiceHeard ? "voice heard" : "NO VOICE HEARD",
        entry.checks.headTurn ? "head turn done" : "head turn skipped",
      ].join(", ")
    : "uploaded file, not checked"

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
    text: `${text}\n\nOpen the folder: ${consoleUrl}`,
    html: `${html}<p style="font:15px/1.5 -apple-system,Segoe UI,sans-serif"><a href="${escapeHtml(consoleUrl)}">Open the folder in Firebase</a></p>`,
    replyTo: { email: entry.email, name: entry.name || undefined },
  })
}
