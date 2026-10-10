import { Composition, staticFile } from "remotion"

import fixture from "./fixtures/props.json"
import { Sample } from "./Sample"
import { durationInFrames, FPS, HEIGHT, WIDTH, type SampleProps } from "./types"

// Fixture props point at the media scripts/make-fixtures.sh synthesises.
const defaultProps: SampleProps = {
  ...(fixture as Omit<SampleProps, "talkingUrl" | "speechUrl" | "musicUrl" | "sfxWhooshUrl" | "sfxPopUrl">),
  talkingUrl: staticFile("talking.mp4"),
  speechUrl: staticFile("speech.mp3"),
  musicUrl: staticFile("music.mp3"),
  sfxWhooshUrl: staticFile("sfx-whoosh.mp3"),
  sfxPopUrl: staticFile("sfx-pop.mp3"),
}

export function RemotionRoot() {
  return (
    <Composition
      id="Sample"
      component={Sample}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={durationInFrames(defaultProps.speechSeconds)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({ durationInFrames: durationInFrames(props.speechSeconds) })}
    />
  )
}
