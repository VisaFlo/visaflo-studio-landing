// Where a visitor came from, so every signup can be credited to a channel.
// UTM tags and `cid` (the VisaFlo company id we add to links sent to existing
// customers) are read from the landing URL. The first visit is kept for good;
// `last` is replaced by each later visit that arrives with tags.

export const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "cid",
] as const

type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number]

export type Touch = Partial<Record<AttributionParam, string>> & {
  /** External referrer host, e.g. "www.linkedin.com". Same-site referrers are dropped. */
  referrer?: string
  /** Path the visitor landed on, e.g. "/chart". */
  landing?: string
  /** ISO timestamp of the visit. */
  at?: string
}

export type Attribution = { first?: Touch; last?: Touch }

const STORAGE_KEY = "vf_attribution"
const MAX_VALUE_LENGTH = 200

let current: Attribution = {}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH)
  return trimmed || undefined
}

function externalReferrer(): string | undefined {
  try {
    const host = new URL(document.referrer).host
    return host && host !== window.location.host ? host : undefined
  } catch {
    return undefined
  }
}

// Runs once per page load, before hydration (see instrumentation-client.ts).
export function captureAttribution(): Attribution {
  const params = new URL(window.location.href).searchParams
  const touch: Touch = {}
  for (const key of ATTRIBUTION_PARAMS) {
    const value = clean(params.get(key))
    if (value) touch[key] = value
  }
  const tagged = Object.keys(touch).length > 0
  const referrer = externalReferrer()
  if (referrer) touch.referrer = referrer
  touch.landing = window.location.pathname
  touch.at = new Date().toISOString()

  // Storage can be blocked (private mode, strict settings); attribution then
  // covers this page load only.
  let stored: Attribution = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Attribution
  } catch {}

  current = {
    first: stored.first ?? touch,
    last: tagged ? touch : stored.last,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {}
  return current
}

export function getAttribution(): Attribution {
  return current
}

function parseTouch(value: unknown): Touch | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const input = value as Record<string, unknown>
  const touch: Touch = {}
  for (const key of [...ATTRIBUTION_PARAMS, "referrer", "landing", "at"] as const) {
    const text = clean(input[key])
    if (text) touch[key] = text
  }
  return Object.keys(touch).length > 0 ? touch : undefined
}

// Validates attribution from an untrusted request body. Anything malformed is
// dropped rather than failing the signup.
export function parseAttribution(value: unknown): Attribution | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const input = value as Record<string, unknown>
  const first = parseTouch(input.first)
  const last = parseTouch(input.last)
  return first || last ? { first, last } : undefined
}
