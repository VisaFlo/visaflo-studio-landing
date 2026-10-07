import { parseAttribution, type Attribution } from "@/lib/attribution"

export const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

export const WAITLIST_SOURCES = ["hero", "waitlist"] as const
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number]

export const INVALID_EMAIL_MESSAGE = "Please enter a valid email address."

export type WaitlistEntry = {
  email: string
  name?: string
  firm?: string
  source: WaitlistSource
  attribution?: Attribution
}

type ParseResult =
  | { ok: true; entry: WaitlistEntry }
  | { ok: false; error: string }

const MAX_EMAIL_LENGTH = 254
const MAX_TEXT_LENGTH = 200

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().slice(0, MAX_TEXT_LENGTH)
  return trimmed || undefined
}

// Validates an untrusted request body. Emails are lowercased so the store can
// dedupe on them.
export function parseWaitlistEntry(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." }
  }
  const input = body as Record<string, unknown>

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: INVALID_EMAIL_MESSAGE }
  }

  const source = WAITLIST_SOURCES.find((s) => s === input.source)
  if (!source) {
    return { ok: false, error: "Invalid source." }
  }

  return {
    ok: true,
    entry: {
      email,
      name: optionalText(input.name),
      firm: optionalText(input.firm),
      source,
      attribution: parseAttribution(input.attribution),
    },
  }
}
