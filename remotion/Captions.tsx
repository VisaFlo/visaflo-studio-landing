import { useCurrentFrame } from "remotion"

import { groupWords } from "./group-words"
import { FPS, type Word } from "./types"

// Lower-third karaoke captions: the current group in white, the spoken word
// highlighted. Kept well above the bottom for platform UI.
export function Captions({ words, layout }: { words: Word[]; layout: "boxed" | "full" }) {
  const t = useCurrentFrame() / FPS
  const group = groupWords(words).find((g) => t >= g.start && t < g.end)
  if (!group) return null
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: layout === "boxed" ? 420 : 300,
        textAlign: "center",
        fontSize: 64,
        fontWeight: 700,
        lineHeight: 1.15,
        textShadow: "0 4px 24px rgba(0,0,0,0.8)",
      }}
    >
      {group.words.map((w, i) => {
        const active = t >= w.start && t <= w.end + 0.05
        return (
          <span
            key={i}
            style={{ color: active ? "#fbbf24" : "white", marginRight: 18, display: "inline-block", transform: active ? "scale(1.06)" : "none" }}
          >
            {w.word}
          </span>
        )
      })}
    </div>
  )
}
