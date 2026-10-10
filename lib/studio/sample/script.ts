import OpenAI from "openai"

export type ScriptLine = { tts_text: string; caption_text: string }
export type ScriptCard = {
  line: number
  label: string
  value: string
  sub: string | null
  /** stat (default): a number or short phrase, up to 12 characters. note: a sentence, up to 60. */
  kind?: "stat" | "note"
  /** takeover: shown full-screen without the person, with the other takeover cards on nearby lines. */
  scene?: "takeover"
}

export const NOTE_VALUE_MAX = 60
export type Script = {
  headline: string
  published: string
  lines: ScriptLine[]
  cards: ScriptCard[]
  sources: { url: string; title: string }[]
  facts: { claim: string; source_url: string }[]
  estimated_seconds: number
}
export type ScriptFile = {
  draft: Script
  approved: boolean
  model: string
  createdAt: string
  editedAt?: string
  notes?: string
  searchSources: string[]
}

export const SCRIPT_MODEL = "gpt-6-sol"

// The rules the landing samples were made under, written down once.
export const SCRIPT_SYSTEM_PROMPT = `You write 25-second vertical news shorts for licensed Canadian immigration consultants. The consultant appears on camera (AI-generated with their written consent) and speaks your script in their own cloned voice. Viewers are prospective immigrants and their families; they want to know what changed and what to do.

Rules
- 65 to 85 words total. Read aloud at a brisk news pace that is 22 to 28 seconds.
- Shape: one-line hook stating the change in plain words → what exactly changed (numbers, dates, who is affected) → what it means or one action to take → one-line sign-off inviting viewers to follow for next week's update.
- First person, straight to camera, plain English, short sentences. No greeting, no self-introduction, no firm name, no jargon, no legal advice beyond "check with a licensed professional".
- Every number, date, program name and quote must appear on a canada.ca page you actually read in this session. Do not round, convert, infer or carry over from memory. If a figure is not on the page, leave it out.
- Write the acronym as "I-R-C-C" in tts_text and "IRCC" in caption_text. Spell out other acronyms the first time.
- tts_text may use at most two ElevenLabs delivery tags in the whole script, chosen from [confident] [serious] [warm] [pause], placed at the start of a line. caption_text never contains tags and matches the spoken words exactly, with numbers written as digits.
- Cards: 2 to 4 facts worth seeing on screen (a number, a date, a group of people). value is at most 12 characters and must stand on one line; label is at most 28 characters; sub is optional, at most 40. Each card points at the index of the line during which it should appear.
- Return JSON only.`

export function scriptUserPrompt(input: { topic: string; ownTopic?: string; today: string; notes?: string }): string {
  return `Topic area: ${input.topic}
Consultant's own topic, if any: ${input.ownTopic || "none"}
Today: ${input.today}
Admin notes: ${input.notes || "none"}

Search canada.ca for the most recent official IRCC / Government of Canada change or announcement in this area. Prefer the last 14 days; otherwise the most recent you can find. Read the page(s), then write the script.`
}

export const SCRIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "published", "lines", "cards", "sources", "facts", "estimated_seconds"],
  properties: {
    headline: { type: "string" },
    published: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tts_text", "caption_text"],
        properties: { tts_text: { type: "string" }, caption_text: { type: "string" } },
      },
    },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line", "label", "value", "sub"],
        properties: {
          line: { type: "integer" },
          label: { type: "string" },
          value: { type: "string" },
          sub: { type: ["string", "null"] },
        },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "title"],
        properties: { url: { type: "string" }, title: { type: "string" } },
      },
    },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "source_url"],
        properties: { claim: { type: "string" }, source_url: { type: "string" } },
      },
    },
    estimated_seconds: { type: "number" },
  },
} as const

export function stripTags(text: string): string {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim()
}

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

export function scriptWords(script: Script): number {
  return script.lines.reduce((n, l) => n + words(stripTags(l.tts_text)), 0)
}

export function validateScript(value: unknown): { ok: true; script: Script } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const s = value as Script | null
  if (!s || typeof s !== "object" || !Array.isArray(s.lines) || !Array.isArray(s.cards) || !Array.isArray(s.sources)) {
    return { ok: false, errors: ["Script is not an object with lines, cards and sources."] }
  }
  if (typeof s.headline !== "string" || !s.headline.trim()) errors.push("headline is empty")
  if (s.lines.length < 3 || s.lines.length > 14) errors.push(`expected 3–14 lines, got ${s.lines.length}`)
  s.lines.forEach((l, i) => {
    if (!l || typeof l.tts_text !== "string" || !l.tts_text.trim()) errors.push(`line ${i}: tts_text is empty`)
    if (!l || typeof l.caption_text !== "string" || !l.caption_text.trim()) errors.push(`line ${i}: caption_text is empty`)
    else if (/\[[^\]]*\]/.test(l.caption_text)) errors.push(`line ${i}: caption_text contains a tag`)
  })
  const total = scriptWords(s)
  if (total < 50 || total > 100) errors.push(`script has ${total} words; aim for 65–85`)
  // GPT is asked for 2–4; the fixed scripts carry up to 6 (takeover pairs).
  if (s.cards.length > 6) errors.push("more than 6 cards")
  s.cards.forEach((c, i) => {
    if (!c || !Number.isInteger(c.line) || c.line < 0 || c.line >= s.lines.length) errors.push(`card ${i}: line index out of range`)
    const max = c?.kind === "note" ? NOTE_VALUE_MAX : 12
    if (!c || typeof c.value !== "string" || !c.value.trim() || c.value.length > max) errors.push(`card ${i}: value must be 1–${max} characters`)
    if (c && c.kind != null && c.kind !== "stat" && c.kind !== "note") errors.push(`card ${i}: kind must be stat or note`)
    if (c && c.scene != null && c.scene !== "takeover") errors.push(`card ${i}: scene can only be takeover`)
    if (!c || typeof c.label !== "string" || !c.label.trim() || c.label.length > 28) errors.push(`card ${i}: label must be 1–28 characters`)
    if (c && c.sub != null && (typeof c.sub !== "string" || c.sub.length > 40)) errors.push(`card ${i}: sub must be at most 40 characters`)
  })
  if (!s.sources.length) errors.push("no sources")
  s.sources.forEach((src, i) => {
    let host = ""
    try {
      host = new URL(src.url).hostname
    } catch {}
    if (!(host === "canada.ca" || host.endsWith(".canada.ca"))) errors.push(`source ${i}: not on canada.ca (${src.url})`)
  })
  return errors.length ? { ok: false, errors } : { ok: true, script: s }
}

// One Responses API call: search canada.ca, read, write. Structured output
// guarantees the shape; validateScript enforces our rules on top.
export async function generateScript(
  input: Parameters<typeof scriptUserPrompt>[0],
): Promise<{ script: Script; searchSources: string[] }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.create({
    model: SCRIPT_MODEL,
    instructions: SCRIPT_SYSTEM_PROMPT,
    input: scriptUserPrompt(input),
    reasoning: { effort: "medium" },
    tools: [{ type: "web_search", filters: { allowed_domains: ["canada.ca"] } }],
    include: ["web_search_call.action.sources"],
    text: {
      format: {
        type: "json_schema",
        name: "script",
        schema: SCRIPT_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  })
  const searchSources = response.output
    .filter((item) => item.type === "web_search_call")
    .flatMap((item) => {
      const action = (item as { action?: { sources?: { url: string }[] } }).action
      return (action?.sources ?? []).map((s) => s.url)
    })
  const parsed = validateScript(JSON.parse(response.output_text))
  if (!parsed.ok) throw new Error(`Script failed our checks: ${parsed.errors.join("; ")}`)
  return { script: parsed.script, searchSources: Array.from(new Set(searchSources)) }
}
