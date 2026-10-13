import { isPlainObject, parseChecks, type RecordingChecks } from "@/lib/studio/checks"

// request.json is written by the person's own browser under their own uid
// (lib/studio/upload.ts), and the same fields arrive in the body of
// POST /api/studio/requests. Both are read field by field here, never cast:
// a wrong type or an oversized value must not break the admin page or the
// team email for that submission.

/** Caps on what is kept; the consent text gets headroom for a longer wording. */
export const LIMITS = {
  text: 200,
  topicTitle: 500,
  consent: 2000,
  timestamp: 40,
  submissionId: 64,
  recordingPath: 300,
} as const

/** Longest length kept: a day, far above the flow's MAX_SECONDS. */
const MAX_SECONDS_KEPT = 24 * 60 * 60

// Free text: trimmed and cut at `max`.
export function text(value: unknown, max: number = LIMITS.text): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined
}

// An identifier (submission id, object path): exactly as sent or not at all,
// since a cut or trimmed identifier is a different identifier.
export function identifier(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined
}

// One plain address. Anything with whitespace or a character that could add
// recipients or a body once the admin page puts it in a mailto: link
// (? & % , ; #) is dropped.
export function asEmail(value: unknown): string | undefined {
  const candidate = text(value)
  return candidate && /^[^\s@?&%,;#]+@[^\s@?&%,;#]+$/.test(candidate) ? candidate : undefined
}

// A timestamp Date.parse understands, normalised to ISO: the list is sorted
// on these strings, so a differently spelled one would land in the wrong
// place.
export function isoDate(value: unknown): string | undefined {
  const candidate = text(value, LIMITS.timestamp)
  const time = candidate ? Date.parse(candidate) : NaN
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

// A recording length in whole seconds: a number or a decimal string (not
// whatever Number() would coerce), positive once rounded, and at most a day.
export function seconds(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : NaN
  const n = Math.round(numeric)
  return Number.isFinite(n) && n > 0 && n <= MAX_SECONDS_KEPT ? n : undefined
}

export type RequestJson = {
  email?: string
  name?: string
  firm?: string
  topicTitle?: string
  recordingSeconds?: number
  checks?: RecordingChecks
  consent?: string
  consentAt?: string
  createdAt?: string
}

export function readRequestJson(raw: unknown): RequestJson {
  if (!isPlainObject(raw)) return {}
  const out: RequestJson = {}
  const put = <K extends keyof RequestJson>(key: K, value: RequestJson[K] | undefined) => {
    if (value !== undefined) out[key] = value
  }
  put("email", asEmail(raw.email))
  put("name", text(raw.name))
  put("firm", text(raw.firm))
  put("topicTitle", text(raw.topicTitle, LIMITS.topicTitle))
  put("recordingSeconds", seconds(raw.recordingSeconds))
  put("checks", parseChecks(raw.checks))
  put("consent", text(raw.consent, LIMITS.consent))
  put("consentAt", isoDate(raw.consentAt))
  put("createdAt", isoDate(raw.createdAt))
  return out
}
