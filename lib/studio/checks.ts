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

// Short labels for /admin: only what failed or never ran.
export function checkFlags(checks?: RecordingChecks): string[] {
  if (!checks) return []
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
