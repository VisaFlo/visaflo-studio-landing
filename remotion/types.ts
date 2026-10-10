// Copies of the server shapes the composition needs, so the Remotion bundle
// has no "@/" imports. The server imports this file as types only.
export type Word = { word: string; start: number; end: number; line: number }
export type Card = {
  line: number
  label: string
  value: string
  sub: string | null
  /** stat: a big number or short phrase (default). note: a sentence; "\n" breaks lines, "• " rows get a dot. */
  kind?: "stat" | "note"
  /** takeover: the person steps aside and this card fills the screen with the others marked the same on nearby lines. */
  scene?: "takeover"
}

export const PALETTES = ["navy", "wine", "forest", "paper"] as const
export type Palette = (typeof PALETTES)[number]

export type SampleProps = {
  talkingUrl: string
  speechUrl: string
  musicUrl: string
  sfxWhooshUrl: string
  sfxPopUrl: string
  words: Word[]
  cards: Card[]
  layout: "boxed" | "full"
  headline: string
  /** YYYY-MM-DD of the source page. */
  published: string
  topicTitle: string
  palette: Palette
  speechSeconds: number
}

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920
export const TAIL_SECONDS = 1.5
/** The headline card slides in this long after the start. */
export const HEADLINE_FROM = 0.4

export function durationInFrames(speechSeconds: number): number {
  return Math.ceil((speechSeconds + TAIL_SECONDS) * FPS)
}
