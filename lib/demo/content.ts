// Content for the /demo studio mock: nothing here is fetched or generated.
// The stories mirror Regulatory Monitor alerts (worktree-3 Dashboard) and the
// landing samples, so the numbers match videos people have already seen.

export type ToneId = "plain" | "urgent" | "friendly"
export type CtaId = "none" | "follow" | "book" | "dm"
export type LengthId = "short" | "standard" | "long"
export type CaptionId = "bold" | "highlight" | "boxed"
export type VisualId = "clean" | "brand" | "newsroom"
export type Severity = "high" | "medium" | "low"
export type Topic = "Express Entry" | "Work" | "Study" | "Family"

export type Story = {
  id: string
  severity: Severity
  topic: Topic
  kind: string
  jurisdiction: string
  detected: string
  /** Short label on the video's headline card. */
  tag: string
  title: string
  summary: string
  source: string
  hooks: Record<ToneId, string>
  body: string[]
  /** The extra line a long script adds before the ending. */
  extra: string
  /** Caption for the post that carries the finished video. */
  post: string
}

export const THEMES = [
  { id: "harbour", name: "Harbour", hex: "#1f3a5f" },
  { id: "maple", name: "Maple", hex: "#a3261b" },
  { id: "pine", name: "Pine", hex: "#2f5d50" },
  { id: "plum", name: "Plum", hex: "#5b3a6b" },
  { id: "amber", name: "Amber", hex: "#8a4510" },
  { id: "ink", name: "Ink", hex: "#1c1917" },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]

export const CAPTIONS: { id: CaptionId; name: string }[] = [
  { id: "bold", name: "Bold white" },
  { id: "highlight", name: "Brand highlight" },
  { id: "boxed", name: "Boxed" },
]

export const VISUALS: { id: VisualId; name: string; description: string }[] = [
  { id: "clean", name: "Clean card", description: "White card, quiet and professional" },
  { id: "brand", name: "Brand card", description: "Your theme color up front" },
  { id: "newsroom", name: "Newsroom", description: "Breaking-news bar across the top" },
]

export const TONES: { id: ToneId; name: string }[] = [
  { id: "plain", name: "Straight news" },
  { id: "urgent", name: "Heads-up" },
  { id: "friendly", name: "Friendly" },
]

export const CTAS: { id: CtaId; name: string; line: string }[] = [
  { id: "none", name: "No ending", line: "" },
  { id: "follow", name: "Follow for updates", line: "Follow along for next week's update." },
  { id: "book", name: "Book a consult", line: "Want to know what this means for you? Book a consultation. Link in bio." },
  { id: "dm", name: "DM me", line: "Questions about your case? Send me a DM." },
]

export const LENGTHS: { id: LengthId; name: string }[] = [
  { id: "short", name: "Short · ~15s" },
  { id: "standard", name: "Standard · ~25s" },
  { id: "long", name: "Long · ~40s" },
]

export const TOPICS: ("All" | Topic)[] = ["All", "Express Entry", "Work", "Study", "Family"]

export const NEWS: Story[] = [
  {
    id: "n1",
    severity: "high",
    topic: "Express Entry",
    kind: "EE draw",
    jurisdiction: "Federal (IRCC)",
    detected: "2h ago",
    tag: "Express Entry",
    title: "CEC draw: 2,000 invitations, CRS 518",
    summary:
      "IRCC invited 2,000 Canadian Experience Class candidates. The cut-off fell for the third draw in a row, from 519 to 518.",
    source: "Express Entry: Rounds of invitations",
    hooks: {
      plain: "New Express Entry draw, and the cut-off dropped again.",
      urgent: "Heads up: the Express Entry cut-off just dropped again.",
      friendly: "Good news if you're in the Express Entry pool!",
    },
    body: [
      "IRCC just invited 2,000 Canadian Experience Class candidates, with a cut-off of 518.",
      "That's three draws in a row going down: 521, 519, now 518.",
      "If your score is close, keep your profile up to date. Your invitation could come next round.",
    ],
    extra: "Not in the pool yet? Check your score with IRCC's CRS tool before you create a profile.",
    post: "New Express Entry draw: 2,000 CEC invitations, cut-off 518. Third drop in a row. If your score is close, keep your profile up to date. #ExpressEntry #CanadaImmigration #CRS",
  },
  {
    id: "n2",
    severity: "medium",
    topic: "Work",
    kind: "Changed",
    jurisdiction: "Federal (IRCC)",
    detected: "Yesterday",
    tag: "Work permit",
    title: "Study up to 6 months on a work permit, no study permit needed",
    summary:
      "IRCC updated its study permit exemptions page: workers can take a program of 6 months or less while their work permit is valid.",
    source: "Work permits",
    // The standard, plain, no-ending script is word for word what public/demo/result-v2.mp4 says.
    hooks: {
      plain: "Okay, this one's big.",
      urgent: "Work permit holders: you may not need a study permit.",
      friendly: "Good news if you're working in Canada and want to study!",
    },
    body: [
      "If you're in Canada on a work permit, starting this month, eligible work permit holders can study a program of up to six months, no separate study permit needed.",
      "Two things to check before you enroll.",
      "One, your work permit has to stay valid for the whole program.",
      "Two, the program has to be six months or less. Anything longer still needs a study permit.",
    ],
    extra: "Make sure your work permit stays valid for the whole program before you enrol.",
    post: "On a work permit and thinking about a short program? You may not need a separate study permit for programs of 6 months or less. Two checks before you enroll. #WorkPermit #StudyInCanada",
  },
  {
    id: "n3",
    severity: "medium",
    topic: "Study",
    kind: "Changed",
    jurisdiction: "Federal (IRCC)",
    detected: "Yesterday",
    tag: "Study permit",
    title: "Proof of funds for study permits rises to $23,448",
    summary: "The minimum funds a single student must show, outside Quebec, go up for applications received from September 1.",
    source: "Study permits",
    hooks: {
      plain: "Applying for a study permit? The number just changed.",
      urgent: "Study permit applicants: the money you need to show just went up.",
      friendly: "Planning to study in Canada? Here's one number to update.",
    },
    body: [
      "The proof-of-funds minimum for a single student outside Quebec is now $23,448.",
      "That's on top of your first year of tuition and travel.",
      "Check your bank documents before you apply so your file isn't refused.",
    ],
    extra: "Bringing family? The amount goes up for each family member who comes with you.",
    post: "Study permit applicants: the proof-of-funds minimum is now $23,448 for a single student outside Quebec. Plan your finances before you apply. #StudyPermit #InternationalStudents",
  },
  {
    id: "n4",
    severity: "high",
    topic: "Family",
    kind: "Changed",
    jurisdiction: "Federal (IRCC)",
    detected: "2 days ago",
    tag: "Family sponsorship",
    title: "Parents and grandparents: intake paused, super visa stays open",
    summary: "IRCC will not open new Parents and Grandparents Program intake this year. The super visa remains available.",
    source: "Family sponsorship",
    hooks: {
      plain: "Planning to sponsor your parents? Read this first.",
      urgent: "Parents and grandparents sponsorship is on pause this year.",
      friendly: "Want your parents closer to you in Canada? There's still a way.",
    },
    body: [
      "IRCC won't open new Parents and Grandparents Program intake this year.",
      "But the super visa is still open, and it lets parents stay for years at a time.",
      "If you were waiting on PGP, the super visa could be your next step.",
    ],
    extra: "Super visa applicants need valid medical insurance, and the host has to meet the income requirement.",
    post: "No new PGP intake this year, but the super visa is still open for parents and grandparents. Here is what that means for your family. #SuperVisa #FamilySponsorship",
  },
  {
    id: "n5",
    severity: "medium",
    topic: "Work",
    kind: "Processing times",
    jurisdiction: "Federal (IRCC)",
    detected: "3 days ago",
    tag: "Processing times",
    title: "Seasonal Agricultural Worker Program: 19 → 26 days",
    summary: "Processing times for the Seasonal Agricultural Worker Program were updated on the IRCC processing times page.",
    source: "Processing times",
    hooks: {
      plain: "Hiring seasonal workers? Plan for a longer wait.",
      urgent: "Employers: seasonal worker permits are taking a week longer.",
      friendly: "Quick update for farms hiring seasonal workers.",
    },
    body: [
      "Processing for the Seasonal Agricultural Worker Program moved from 19 to 26 days.",
      "That's an extra week before your workers can arrive.",
      "Submit early so your season isn't short-staffed.",
    ],
    extra: "Check IRCC's processing times page before you lock in start dates.",
    post: "SAWP processing times just moved from 19 to 26 days. Employers: build the extra week into your hiring plan. #SAWP #LMIA #CanadaWork",
  },
  {
    id: "n6",
    severity: "low",
    topic: "Express Entry",
    kind: "Form updated",
    jurisdiction: "Federal (IRCC)",
    detected: "4 days ago",
    tag: "Forms",
    title: "IMM 5987 checklist: new 01-06-2026 edition published",
    summary: "IRCC replaced the IMM 5987 document checklist. Applications on the outdated edition may be returned.",
    source: "IRCC application forms (editions)",
    hooks: {
      plain: "Using an old IRCC form? Your file could come back.",
      urgent: "Stop: check your IMM 5987 checklist before you submit.",
      friendly: "A quick form check that could save you weeks.",
    },
    body: [
      "IRCC just published a new edition of the IMM 5987 document checklist.",
      "Applications on the outdated edition may be returned.",
      "Download the latest version from IRCC before you submit.",
    ],
    extra: "It takes a minute to check the edition date printed on each form.",
    post: "IRCC published a new edition of the IMM 5987 checklist. Old editions may be returned, so double-check before you submit. #IRCC #ImmigrationForms",
  },
]

/**
 * The one path the demo video was rendered for. Every choice on /demo is preset to
 * these and cannot be changed, so the finished video matches what was picked.
 */
export const DEMO = {
  storyId: "n2",
  theme: "harbour",
  caption: "bold",
  visual: "brand",
  tone: "plain",
  cta: "none",
  length: "standard",
  video: "/demo/result-v2.mp4",
  poster: "/demo/result-v2.jpg",
  videoSeconds: 25,
} as const satisfies {
  storyId: string
  theme: ThemeId
  caption: CaptionId
  visual: VisualId
  tone: ToneId
  cta: CtaId
  length: LengthId
  video: string
  poster: string
  videoSeconds: number
}

/** The script the studio "writes" for a story: one line per sentence, hook first and call to action last. */
export function buildScript(storyId: string, tone: ToneId, cta: CtaId, length: LengthId): string {
  const story = NEWS.find((n) => n.id === storyId)
  if (!story) throw new Error(`Unknown story: ${storyId}`)
  const ending = CTAS.find((c) => c.id === cta)!.line
  const body = length === "short" ? story.body.slice(0, 1) : length === "long" ? [...story.body, story.extra] : story.body
  return [story.hooks[tone], ...body, ending].filter(Boolean).join("\n")
}

/** Spoken length at 2.75 words a second (the demo video's pace), never under 8 seconds. */
export function estimateSeconds(script: string): number {
  const words = script.split(/\s+/).filter(Boolean).length
  return Math.max(8, Math.round(words / 2.75))
}

export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
