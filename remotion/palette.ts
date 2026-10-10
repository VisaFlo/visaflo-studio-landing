import type { Palette } from "./types"

// Colours of the four landing-sample looks: the card, its text, the small
// accent label, and the full-screen takeover background.
export type Look = {
  card: string
  cardText: string
  label: string
  muted: string
  takeover: [string, string]
  pill: string
  pillText: string
}

export const LOOKS: Record<Palette, Look> = {
  navy: {
    card: "rgba(28, 25, 58, 0.92)",
    cardText: "#ffffff",
    label: "#ff8fc0",
    muted: "rgba(255, 255, 255, 0.78)",
    takeover: ["#1a1f4d", "#090b24"],
    pill: "#ff8fc0",
    pillText: "#1c193a",
  },
  wine: {
    card: "linear-gradient(180deg, #8f2024 0%, #5a1013 100%)",
    cardText: "#fff6ee",
    label: "#f6b26b",
    muted: "rgba(255, 246, 238, 0.8)",
    takeover: ["#4d1013", "#1a0506"],
    pill: "#f6b26b",
    pillText: "#4d1013",
  },
  forest: {
    card: "linear-gradient(180deg, #156e55 0%, #0b3b2d 100%)",
    cardText: "#f3fff9",
    label: "#6fe3b6",
    muted: "rgba(243, 255, 249, 0.8)",
    takeover: ["#0f4b3a", "#051a13"],
    pill: "#6fe3b6",
    pillText: "#0b3b2d",
  },
  paper: {
    card: "rgba(251, 250, 247, 0.96)",
    cardText: "#141414",
    label: "#d7261e",
    muted: "rgba(20, 20, 20, 0.68)",
    takeover: ["#1c1c3c", "#0a0a1f"],
    pill: "#d7261e",
    pillText: "#ffffff",
  },
}

// "2026-09-29" → "September 29, 2026"
export function longDate(published: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(published)
  if (!m) return published
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}
