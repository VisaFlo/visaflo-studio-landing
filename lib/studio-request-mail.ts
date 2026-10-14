import { escapeHtml, sendMail, TEAM_INBOX } from "@/lib/sendgrid"
import { describeChecks, type RecordingChecks } from "@/lib/studio/checks"
import { BUCKET } from "@/lib/studio/project"
import { detailsTable, vancouverTime } from "@/lib/waitlist-mail"

// One email per finished recording, to the same inbox as waitlist signups.
// Fixed subject so the inbox can filter and count them.
export const SUBJECT = "[VisaFlo Studio] New sample recording"

export type StudioRequestMail = {
  /** As typed on /start: nobody signs in there, so nothing has verified it. */
  email: string
  name: string
  firm: string
  topicTitle: string
  submissionId: string
  recordingPath: string
  recordingSeconds: number
  recordingSource: "camera"
  /**
   * Absent when the body carried no checks object: an older page build, or a
   * request not sent by /start (a current client always sends one,
   * RECOVERED_CHECKS for a recovered take).
   */
  checks?: RecordingChecks
  consentAt: string
  /** The submission's page in /admin. */
  adminUrl: string
}

// m:ss, or "length unknown" when the browser sent no usable length.
function minutes(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "length unknown"
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export async function sendStudioRequestEmail(entry: StudioRequestMail): Promise<void> {
  const checks = entry.checks ? describeChecks(entry.checks) : "no checks sent (older page build or a malformed request)"

  const { text, html } = detailsTable([
    ["Firm name", entry.firm || "—"],
    ["Name", entry.name || "—"],
    ["Email", `${entry.email} (typed, not verified: confirm before using their face)`],
    ["Topic", entry.topicTitle],
    ["Recording", `${minutes(entry.recordingSeconds)} (${entry.recordingSource}), ${checks}`],
    ["File", `gs://${BUCKET}/${entry.recordingPath}`],
    ["Consent", `Agreed ${vancouverTime(new Date(entry.consentAt))}`],
    ["Time", vancouverTime(new Date())],
  ])

  await sendMail({
    to: TEAM_INBOX,
    subject: SUBJECT,
    text: `${text}\n\nOpen it in Studio admin: ${entry.adminUrl}`,
    html: `${html}<p style="font:15px/1.5 -apple-system,Segoe UI,sans-serif"><a href="${escapeHtml(entry.adminUrl)}">Open it in Studio admin</a></p>`,
    replyTo: { email: entry.email, name: entry.name || undefined },
  })
}
