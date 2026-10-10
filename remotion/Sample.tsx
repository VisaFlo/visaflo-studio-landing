import { AbsoluteFill, Audio, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion"

import { Captions } from "./Captions"
import { Cards } from "./Cards"
import { FPS, HEADLINE_SECONDS, type SampleProps } from "./types"

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif"

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
  const { durationInFrames } = useVideoConfig()
  const boxed = props.layout === "boxed"
  const showHeadline = frame < HEADLINE_SECONDS * FPS

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0a09", fontFamily: FONT, color: "white" }}>
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

      {showHeadline && (
        <div
          style={{
            position: "absolute",
            top: boxed ? 160 : 120,
            left: 60,
            right: 60,
            fontSize: 44,
            fontWeight: 600,
            lineHeight: 1.2,
            opacity: Math.min(1, frame / 8) * Math.min(1, (HEADLINE_SECONDS * FPS - frame) / 8),
          }}
        >
          {props.headline}
        </div>
      )}

      <Cards cards={props.cards} words={props.words} layout={props.layout} sfxWhoosh={props.sfxWhooshUrl} sfxPop={props.sfxPopUrl} />
      <Captions words={props.words} layout={props.layout} />
    </AbsoluteFill>
  )
}
