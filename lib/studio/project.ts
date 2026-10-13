// The one Firebase project everything here talks to: sign-in, token
// verification, the recordings bucket and the console links. The bucket name
// is also hard-coded in docs/studio-capture/rules-test.mjs,
// docs/studio-capture/README.md and lib/studio/storage.test.ts; change them
// together.
export const PROJECT_ID = "devdashboard-c9159"
/** Canada-region bucket, the one VisaFlo moved to in 2026-09. */
export const BUCKET = "devdashboard-c9159-ca"

// Containers MediaRecorder produces (mp4 on Safari and newer Chrome, webm
// elsewhere) plus the QuickTime names. docs/studio-capture/storage.rules
// repeats this list by hand; change both.
export const RECORDING_EXTENSIONS = ["mp4", "webm", "mov", "m4v"] as const
