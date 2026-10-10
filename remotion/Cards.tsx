import { Audio, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { FPS, type Card, type Word } from "./types"

type Timed = Card & { at: number }

// A card appears on the first word of its line and stays. Up to three stack
// in the top band, each built label → value → sub so nothing is ever an
// empty box. Values shrink to stay on one line.
function schedule(cards: Card[], words: Word[]): Timed[] {
  return cards
    .map((c) => ({ ...c, at: words.find((w) => w.line === c.line)?.start ?? 0 }))
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
}

function valueSize(value: string): number {
  if (value.length <= 5) return 96
  if (value.length <= 8) return 76
  return 58
}

export function Cards(props: { cards: Card[]; words: Word[]; layout: "boxed" | "full"; sfxWhoosh: string; sfxPop: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const timed = schedule(props.cards, props.words)
  const visible = timed.filter((c) => frame >= c.at * FPS)
  const top = props.layout === "boxed" ? 240 : 150
  return (
    <>
      {timed.map((c, i) => (
        <Sequence key={`sfx-${i}`} from={Math.round(c.at * FPS)} durationInFrames={FPS}>
          <Audio src={i === 0 ? props.sfxWhoosh : props.sfxPop} volume={0.6} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", top, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 20 }}>
        {visible.map((c, i) => {
          const local = frame - Math.round(c.at * FPS)
          const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 160 } })
          const valueIn = Math.min(1, Math.max(0, (local - 4) / 8))
          const subIn = Math.min(1, Math.max(0, (local - 10) / 8))
          return (
            <div
              key={i}
              style={{
                transform: `translateY(${(1 - enter) * -40}px)`,
                opacity: enter,
                background: "rgba(255,255,255,0.94)",
                color: "#0c0a09",
                borderRadius: 24,
                padding: "26px 34px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "#57534e" }}>{c.label}</div>
              <div style={{ fontSize: valueSize(c.value), fontWeight: 800, lineHeight: 1.05, whiteSpace: "nowrap", opacity: valueIn }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 30, color: "#44403c", marginTop: 6, opacity: subIn }}>{c.sub}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}
