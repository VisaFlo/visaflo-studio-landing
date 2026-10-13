import { parseChecks, type RecordingChecks } from "@/lib/studio/checks"

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

export function text(value: unknown, max: number = LIMITS.text): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined
}

// One plain address. Anything with whitespace, "?" or "&" is dropped: the
// admin page puts this in a mailto: link, where those would add recipients
// or a body.
export function isEmail(value: unknown): string | undefined {
  const candidate = text(value)
  return candidate && /^[^\s@?&]+@[^\s@?&]+$/.test(candidate) ? candidate : undefined
}

// A timestamp Date.parse understands, kept as written (the list is sorted
// on these strings, so a stray value would float a row to the wrong place).
export function isoDate(value: unknown): string | undefined {
  const candidate = text(value, LIMITS.timestamp)
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : undefined
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
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const v = raw as Record<string, unknown>
  const out: RequestJson = {}
  const put = <K extends keyof RequestJson>(key: K, value: RequestJson[K] | undefined) => {
    if (value !== undefined) out[key] = value
  }
  put("email", isEmail(v.email))
  put("name", text(v.name))
  put("firm", text(v.firm))
  put("topicTitle", text(v.topicTitle, LIMITS.topicTitle))
  const seconds = Number(v.recordingSeconds)
  if (Number.isFinite(seconds) && seconds > 0) out.recordingSeconds = Math.round(seconds)
  put("checks", parseChecks(v.checks))
  put("consent", text(v.consent, LIMITS.consent))
  put("consentAt", isoDate(v.consentAt))
  put("createdAt", isoDate(v.createdAt))
  return out
}
