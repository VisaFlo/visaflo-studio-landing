import { AbsoluteFill, Audio, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { Label, NoteValue, valueSize } from "./Cards"
import { countUp } from "./count-up"
import { FONTS } from "./fonts"
import { longDate, type Look } from "./palette"
import type { Takeover as Segment, TimedCard } from "./schedule"
import { FPS } from "./types"

const FADE = 0.3

function BigStat({ card, look, local }: { card: TimedCard; look: Look; local: number }) {
  const { fps } = useVideoConfig()
  const enter = spring({ frame: local, fps, config: { damping: 14, stiffness: 180, mass: 0.7 } })
  const progress = Math.min(1, Math.max(0, (local - 2) / 18))
  return (
    <div
      style={{
        padding: "36px 40px 40px",
        borderRadius: 36,
        background: look.card,
        boxShadow: "0 30px 70px rgba(0,0,0,0.4)",
        textAlign: "center",
        transform: `scale(${0.9 + 0.1 * enter})`,
        opacity: Math.min(1, local / 4),
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Label text={card.label} look={look} />
      </div>
      {card.kind === "note" ? (
        <NoteValue value={card.value} look={look} size={44} />
      ) : (
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: valueSize(card.value, 170),
            lineHeight: 1,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: look.cardText,
            marginTop: 8,
            whiteSpace: "nowrap",
          }}
        >
          {countUp(card.value, progress)}
        </div>
      )}
      {card.sub && <div style={{ fontFamily: FONTS.body, fontSize: 30, color: look.muted, marginTop: 10 }}>{card.sub}</div>}
    </div>
  )
}

// The person steps aside and the numbers take the screen: a dark gradient
// with broad diagonal bands, the topic and headline at the top, and the
// stat cards popping in on their words.
export function Takeover(props: { segment: Segment; look: Look; topicTitle: string; headline: string; published: string; sfxPop: string }) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const { segment, look } = props
  const fade = Math.min(1, Math.max(0, (t - segment.start) / FADE)) * Math.min(1, Math.max(0, (segment.end - t) / FADE))
  return (
    <>
      {segment.cards.map((c, i) => (
        <Sequence key={`pop-${i}`} from={Math.round(c.at * FPS)} durationInFrames={FPS}>
          <Audio src={props.sfxPop} volume={0.5} />
        </Sequence>
      ))}
      {fade > 0 && (
        <AbsoluteFill style={{ opacity: fade, background: `linear-gradient(165deg, ${look.takeover[0]} 0%, ${look.takeover[1]} 100%)` }}>
          <AbsoluteFill
            style={{
              backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.055) 0 230px, rgba(0,0,0,0) 230px 560px)",
            }}
          />
          <div style={{ position: "absolute", top: 150, left: 70, right: 70, textAlign: "center", fontFamily: FONTS.body }}>
            <div style={{ fontSize: 30, fontWeight: 500, color: look.label }}>{props.topicTitle}</div>
            <div style={{ fontSize: 50, fontWeight: 600, lineHeight: 1.2, color: "#ffffff", marginTop: 8 }}>{props.headline}</div>
            <div style={{ fontSize: 30, color: "rgba(255,255,255,0.7)", marginTop: 10 }}>{longDate(props.published)}</div>
          </div>
          <div style={{ position: "absolute", top: 500, left: 90, right: 90, display: "flex", flexDirection: "column", gap: 40 }}>
            {segment.cards
              .filter((c) => t >= c.at)
              .map((c) => (
                <BigStat key={`${c.line}-${c.label}`} card={c} look={look} local={frame - Math.round(c.at * FPS)} />
              ))}
          </div>
        </AbsoluteFill>
      )}
    </>
  )
}
