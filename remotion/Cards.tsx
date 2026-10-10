import { Audio, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { scheduleCards, visibleCards } from "./cards-schedule"
import { FPS, HEADLINE_SECONDS, type Card, type Word } from "./types"

function valueSize(value: string): number {
  if (value.length <= 5) return 96
  if (value.length <= 8) return 76
  return 58
}

// Cards sit in the band above the face: at most two at a time (the newest
// replaces the oldest), each built label → value → sub so nothing is ever an
// empty box. Values shrink to stay on one line.
export function Cards(props: { cards: Card[]; words: Word[]; layout: "boxed" | "full"; sfxWhoosh: string; sfxPop: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const timed = scheduleCards(props.cards, props.words, HEADLINE_SECONDS)
  const visible = visibleCards(timed, frame / FPS)
  const top = props.layout === "boxed" ? 200 : 140
  return (
    <>
      {timed.map((c, i) => (
        <Sequence key={`sfx-${i}`} from={Math.round(c.at * FPS)} durationInFrames={FPS}>
          <Audio src={i === 0 ? props.sfxWhoosh : props.sfxPop} volume={0.6} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", top, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 20 }}>
        {visible.map((c) => {
          const local = frame - Math.round(c.at * FPS)
          const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 160 } })
          const valueIn = Math.min(1, Math.max(0, (local - 4) / 8))
          const subIn = Math.min(1, Math.max(0, (local - 10) / 8))
          return (
            <div
              key={`${c.line}-${c.label}`}
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
