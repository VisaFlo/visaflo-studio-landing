import { Audio, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { countUp } from "./count-up"
import { FONTS } from "./fonts"
import { longDate, type Look } from "./palette"
import { scheduleCards, topCard, type TimedCard } from "./schedule"
import { FPS, HEADLINE_FROM, type Card, type Word } from "./types"

export function valueSize(value: string, max = 118): number {
  // Bebas Neue is narrow: about 0.42 em per character; the card is 960 px
  // wide with 80 px of padding.
  return Math.min(max, Math.floor(880 / (0.42 * Math.max(4, value.length))))
}

export function Label({ text, look }: { text: string; look: Look }) {
  return (
    <div style={{ fontFamily: FONTS.body, fontSize: 24, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: look.label }}>
      {text}
    </div>
  )
}

// A note's sentence; "\n" breaks lines and "• " rows get a coloured dot.
export function NoteValue({ value, look, size = 40 }: { value: string; look: Look; size?: number }) {
  return (
    <div style={{ fontFamily: FONTS.body, fontSize: size, fontWeight: 600, lineHeight: 1.25, color: look.cardText, marginTop: 8 }}>
      {value.split("\n").map((row, i) => {
        const bullet = row.startsWith("• ")
        return (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            {bullet && <span style={{ color: look.label, fontSize: size * 0.7 }}>●</span>}
            <span>{bullet ? row.slice(2) : row}</span>
          </div>
        )
      })}
    </div>
  )
}

function CardBody({ card, look, local }: { card: Card; look: Look; local: number }) {
  const progress = Math.min(1, Math.max(0, (local - 2) / 16))
  const subIn = Math.min(1, Math.max(0, (local - 6) / 8))
  return (
    <>
      <Label text={card.label} look={look} />
      {card.kind === "note" ? (
        <NoteValue value={card.value} look={look} />
      ) : (
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: valueSize(card.value),
            lineHeight: 1,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: look.cardText,
            marginTop: 6,
            whiteSpace: "nowrap",
          }}
        >
          {countUp(card.value, progress)}
        </div>
      )}
      {card.sub && (
        <div style={{ fontFamily: FONTS.body, fontSize: 28, lineHeight: 1.3, color: look.muted, marginTop: 10, opacity: subIn }}>{card.sub}</div>
      )}
    </>
  )
}

function HeadlineBody({ headline, published, look }: { headline: string; published: string; look: Look }) {
  return (
    <>
      <Label text={`IRCC notice · ${longDate(published)}`} look={look} />
      <div style={{ fontFamily: FONTS.body, fontSize: 40, fontWeight: 600, lineHeight: 1.25, color: look.cardText, marginTop: 8 }}>{headline}</div>
    </>
  )
}

// One card at a time in the slot at the top: the headline card first, then
// each overlay card as its line is spoken, each replacing the last.
export function Cards(props: {
  cards: Card[]
  words: Word[]
  layout: "boxed" | "full"
  look: Look
  headline: string
  published: string
  sfxWhoosh: string
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / FPS
  const timed = scheduleCards(props.cards, props.words)
  const firstAt = timed[0]?.at ?? Infinity
  const current = topCard(timed, t)

  let since: number | null = null
  let body: React.ReactNode = null
  let key = ""
  if (current) {
    since = current.at
    key = `${current.line}-${current.label}`
    body = <CardBody card={current} look={props.look} local={frame - Math.round(current.at * FPS)} />
  } else if (t >= HEADLINE_FROM && t < firstAt) {
    since = HEADLINE_FROM
    key = "headline"
    body = <HeadlineBody headline={props.headline} published={props.published} look={props.look} />
  }

  const entrances: TimedCard[] = timed.filter((c) => c.scene !== "takeover")
  const whooshAt = [...(firstAt > HEADLINE_FROM ? [HEADLINE_FROM] : []), ...entrances.map((c) => c.at)]

  if (since === null) {
    return (
      <>
        {whooshAt.map((at, i) => (
          <Sequence key={`sfx-${i}`} from={Math.round(at * FPS)} durationInFrames={FPS}>
            <Audio src={props.sfxWhoosh} volume={0.45} />
          </Sequence>
        ))}
      </>
    )
  }

  const local = frame - Math.round(since * FPS)
  const enter = spring({ frame: local, fps, config: { damping: 16, stiffness: 170, mass: 0.8 } })
  return (
    <>
      {whooshAt.map((at, i) => (
        <Sequence key={`sfx-${i}`} from={Math.round(at * FPS)} durationInFrames={FPS}>
          <Audio src={props.sfxWhoosh} volume={0.45} />
        </Sequence>
      ))}
      <div
        key={key}
        style={{
          position: "absolute",
          top: props.layout === "boxed" ? 120 : 64,
          left: 60,
          right: 60,
          padding: "34px 40px 38px",
          borderRadius: 30,
          background: props.look.card,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          transform: `scale(${0.92 + 0.08 * enter})`,
          transformOrigin: "50% 0%",
          opacity: Math.min(1, local / 5),
        }}
      >
        {body}
      </div>
    </>
  )
}
