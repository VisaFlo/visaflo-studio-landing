import type { Palette } from "@/remotion/types"

// The look each landing sample was made in; "auto" in the options picks this.
const BY_TOPIC: Record<string, Palette> = {
  "express-entry": "wine",
  "study-permits": "forest",
  "work-permits": "paper",
  family: "navy",
}

export function paletteFor(topicId: string | undefined): Palette {
  return (topicId && BY_TOPIC[topicId]) || "navy"
}
