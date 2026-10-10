import { useCurrentFrame } from "remotion"

import { FONTS } from "./fonts"
import { groupWords, splitLines } from "./group-words"
import { FPS, type Word } from "./types"

// Captions as in the landing samples: a phrase at a time on one or two
// centred lines in the lower part of the frame, words brightening as they
// are spoken, no box.
export function Captions({ words, layout }: { words: Word[]; layout: "boxed" | "full" }) {
  const t = useCurrentFrame() / FPS
  const group = groupWords(words).find((g) => t >= g.start && t < g.end)
  if (!group) return null
  const lines = splitLines(group.words)
  return (
    <div
      style={{
        position: "absolute",
        left: 50,
        right: 50,
        bottom: layout === "boxed" ? 420 : 250,
        textAlign: "center",
        fontFamily: FONTS.body,
        fontSize: 58,
        fontWeight: 700,
        lineHeight: 1.2,
        textShadow: "0 3px 16px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.55)",
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>
          {line.map((w, j) => (
            <span
              key={j}
              style={{
                color: t >= w.start - 0.04 ? "#ffffff" : "rgba(255,255,255,0.45)",
                marginRight: j < line.length - 1 ? 15 : 0,
              }}
            >
              {w.word}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
