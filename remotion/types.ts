// Copies of the server shapes the composition needs, so the Remotion bundle
// has no "@/" imports. The server imports this file as types only.
export type Word = { word: string; start: number; end: number; line: number }
export type Card = { line: number; label: string; value: string; sub: string | null }

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
  speechSeconds: number
}

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920
export const TAIL_SECONDS = 1.5

export function durationInFrames(speechSeconds: number): number {
  return Math.ceil((speechSeconds + TAIL_SECONDS) * FPS)
}
