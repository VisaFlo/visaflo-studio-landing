// What the live checks saw while someone recorded. `null` means there is no
// reading: the check never ran (the face model didn't load, the mic couldn't
// be read) or its result was never saved. The team must be able to tell that
// from "checked and failed". One declaration, shared by the recorder, the
// take store, request.json, the email and /admin.
export type Check = boolean | null

// Read-only: a take's checks are replaced, never edited in place (see
// markPlayable), and RECOVERED_CHECKS is shared.
export type RecordingChecks = {
  readonly faceSeen: Check
  readonly voiceHeard: Check
  /**
   * Whether the review page's player could play the take back: false means
   * the file is probably damaged. Unlike the two checks above this is not
   * tri-state: it is absent when the player reported neither way (playback
   * never got going and no error was reported), which is not a flag. Older
   * request.json files have no such field either.
   */
  readonly playable?: boolean
  /**
   * The live results were lost with the page (a take recovered after it
   * closed mid-recording): the two readings above are placeholders (always
   * null). Read as "checks not recorded", never as "the checks didn't run".
   */
  readonly recovered?: true
}

/** The checks of a take recovered after the page closed mid-recording: nothing saved, says so. */
export const RECOVERED_CHECKS: RecordingChecks = Object.freeze({ faceSeen: null, voiceHeard: null, recovered: true })

const check = (value: unknown): Check => (value === true ? true : value === false ? false : null)

// A non-null, non-array object: what JSON.parse gives for `{…}`. No prototype
// check; every caller passes parsed JSON.
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

// request.json and the request body come from the person's browser, so each
// value is read, never trusted as typed. Readings next to the recovered
// marker can't be real and are not carried.
export function parseChecks(raw: unknown): RecordingChecks | undefined {
  if (!isPlainObject(raw)) return undefined
  const playable = typeof raw.playable === "boolean" ? { playable: raw.playable } : {}
  return raw.recovered === true ? { ...RECOVERED_CHECKS, ...playable } : { faceSeen: check(raw.faceSeen), voiceHeard: check(raw.voiceHeard), ...playable }
}

// The review player's verdict added to a take's checks. A "no" sticks for the
// take (a later replay must not clear a decode failure), and the same object
// is returned when nothing changes, so a replay doesn't re-render the flow.
export function markPlayable(checks: RecordingChecks, playable: boolean): RecordingChecks {
  const next = checks.playable === false ? false : playable
  return checks.playable === next ? checks : { ...checks, playable: next }
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
// with no checks at all (an older client), or whose checks carry the
// `recovered` marker (nothing was saved), is flagged too, so it can't pass
// for a clean take.
export function checkFlags(checks: RecordingChecks | undefined): string[] {
  const flags: string[] = []
  if (!checks || checks.recovered) flags.push("Checks not recorded")
  else {
    if (checks.faceSeen === false) flags.push("No face seen")
    if (checks.faceSeen === null) flags.push("Face check didn't run")
    if (checks.voiceHeard === false) flags.push("No voice heard")
    if (checks.voiceHeard === null) flags.push("Voice check didn't run")
  }
  if (checks?.playable === false) flags.push("Review couldn't play it")
  return flags
}

// One phrase for the team email.
export function describeChecks(checks: RecordingChecks): string {
  const readings = checks.recovered
    ? ["no checks saved (take recovered after the page closed mid-recording)"]
    : [
        checks.faceSeen === true ? "face seen" : checks.faceSeen === false ? "NO FACE SEEN" : "face not checked",
        checks.voiceHeard === true ? "voice heard" : checks.voiceHeard === false ? "NO VOICE HEARD" : "voice not checked",
      ]
  return [...readings, ...(checks.playable === false ? ["REVIEW COULDN'T PLAY IT"] : [])].join(", ")
}
