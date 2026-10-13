// What the live checks saw while someone recorded. `null` means the check
// never ran (the face model didn't load, the mic couldn't be read), which the
// team must be able to tell from "checked and failed". One declaration,
// shared by the recorder, the take store, request.json, the email and /admin.
export type Check = boolean | null

export type RecordingChecks = { faceSeen: Check; voiceHeard: Check }

const check = (value: unknown): Check => (value === true ? true : value === false ? false : null)

// request.json and the request body come from the person's browser, so each
// value is read, never trusted as typed.
export function parseChecks(raw: unknown): RecordingChecks | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const v = raw as Record<string, unknown>
  return { faceSeen: check(v.faceSeen), voiceHeard: check(v.voiceHeard) }
}

// Readings the tracker makes while recording before its tally outweighs what
// the framing step saw: about two seconds at use-face-frames' ~15 readings/s.
export const FACE_MIN_FRAMES = 30

// The recording's face check: with enough readings, the face counts as seen
// if it was found in at least half of them; with fewer, the framing step's
// own reading stands (null when the tracker never ran at all).
export function faceVerdict(frames: { total: number; found: number }, fallback: Check): Check {
  return frames.total >= FACE_MIN_FRAMES ? frames.found / frames.total >= 0.5 : fallback
}

// Short labels for /admin: only what failed or never ran. A finished request
// with no checks at all (the take was recovered after the page closed
// mid-recording, so nothing was measured) is flagged too, so it can't pass
// for a clean take.
export function checkFlags(checks: RecordingChecks | undefined): string[] {
  if (!checks) return ["Checks not recorded"]
  const flags: string[] = []
  if (checks.faceSeen === false) flags.push("No face seen")
  if (checks.faceSeen === null) flags.push("Face check didn't run")
  if (checks.voiceHeard === false) flags.push("No voice heard")
  if (checks.voiceHeard === null) flags.push("Voice check didn't run")
  return flags
}

// One phrase for the team email.
export function describeChecks(checks: RecordingChecks): string {
  const face = checks.faceSeen === true ? "face seen" : checks.faceSeen === false ? "NO FACE SEEN" : "face not checked"
  const voice = checks.voiceHeard === true ? "voice heard" : checks.voiceHeard === false ? "NO VOICE HEARD" : "voice not checked"
  return `${face}, ${voice}`
}
