import { AbsoluteFill, Audio, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion"

import { Captions } from "./Captions"
import { Cards } from "./Cards"
import { FONTS } from "./fonts"
import { LOOKS } from "./palette"
import { scheduleCards, takeoverSegments } from "./schedule"
import { Takeover } from "./Takeover"
import { FPS, type SampleProps } from "./types"

// Music sits under the voice and drops a little further while a word is
// being spoken, so the speech always reads clearly.
function musicVolume(props: SampleProps, frame: number, total: number): number {
  const t = frame / FPS
  const speaking = props.words.some((w) => t >= w.start && t <= w.end)
  const base = speaking ? 0.1 : 0.16
  const fadeIn = Math.min(1, t / 1)
  const fadeOut = Math.min(1, Math.max(0, (total / FPS - t) / 1.5))
  return base * fadeIn * fadeOut
}

export function Sample(props: SampleProps) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const { durationInFrames } = useVideoConfig()
  const boxed = props.layout === "boxed"
  const look = LOOKS[props.palette] ?? LOOKS.navy
  const timed = scheduleCards(props.cards, props.words)
  const segments = takeoverSegments(timed, props.words, durationInFrames / FPS)
  const inTakeover = segments.some((s) => t >= s.start && t < s.end)

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0a09", fontFamily: FONTS.body, color: "white" }}>
      {boxed ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: 1000, height: 562, borderRadius: 28, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
            <OffthreadVideo src={props.talkingUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </AbsoluteFill>
      ) : (
        <OffthreadVideo src={props.talkingUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      <Audio src={props.speechUrl} />
      <Audio src={props.musicUrl} volume={(f) => musicVolume(props, f, durationInFrames)} />

      {segments.map((segment, i) => (
        <Takeover
          key={i}
          segment={segment}
          look={look}
          topicTitle={props.topicTitle}
          headline={props.headline}
          published={props.published}
          sfxPop={props.sfxPopUrl}
        />
      ))}
      {!inTakeover && (
        <Cards
          cards={props.cards}
          words={props.words}
          layout={props.layout}
          look={look}
          headline={props.headline}
          published={props.published}
          sfxWhoosh={props.sfxWhooshUrl}
        />
      )}
      <Captions words={props.words} layout={props.layout} />
    </AbsoluteFill>
  )
}
