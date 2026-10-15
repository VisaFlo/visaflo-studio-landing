// The one Firebase project everything here talks to: sign-in, token
// verification, the recordings bucket and the console links. Both names are
// also hard-coded in docs/studio-capture/README.md, and the bucket in
// docs/studio-capture/rules-test.mjs, lib/studio/storage.test.ts and
// lib/studio-request-mail.test.ts; change them together.
export const PROJECT_ID = "devdashboard-c9159"
/** Canada-region bucket, the one VisaFlo moved to in 2026-09. */
export const BUCKET = "devdashboard-c9159-ca"
/** The named Firestore database VisaFlo's live data is in (the (default) one is frozen). */
export const FIRESTORE_DATABASE_ID = "ca-dryrun"

// Containers MediaRecorder produces (mp4 on Safari and newer Chrome, webm
// elsewhere) plus the QuickTime names. docs/studio-capture/storage.rules
// repeats this list by hand; change both.
export const RECORDING_EXTENSIONS = ["mp4", "webm", "mov", "m4v"] as const
export type RecordingExtension = (typeof RECORDING_EXTENSIONS)[number]

// A submission's folder name, studio/{submissionId}/, as newSubmissionId in
// lib/studio/upload.ts makes it: the UTC time to the second, then 8 hex
// characters. docs/studio-capture/storage.rules repeats this pattern; change
// both.
export const SUBMISSION_ID = /^\d{8}T\d{6}-[0-9a-f]{8}$/

// The portrait photo's name in a submission's folder.
// docs/studio-capture/storage.rules repeats it; change both.
export const PHOTO_FILE = "photo.jpg"

/** The files of a submission an admin can download (/api/admin/recording?file=). */
export const SUBMISSION_FILES = ["recording", "photo"] as const
export type SubmissionFile = (typeof SUBMISSION_FILES)[number]
