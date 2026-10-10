import type { Background } from "@/lib/studio/sample/status"

// Every prompt the pipeline sends to a generation model, in one place, so the
// spec and the code say the same thing.

export const BACKGROUND_PROMPT: Record<Background, string> = {
  office: "a bright modern office with large windows and soft daylight, blurred",
  studio: "a clean neutral studio with a soft warm-grey gradient backdrop",
  street: "a downtown Canadian street at golden hour, softly blurred",
}

export function scenePrompt(background: Background): string {
  return `The person from the reference image, an immigration consultant, speaks directly to the camera like a confident, friendly news presenter, following the reference audio. Medium close-up, head and shoulders, centred, generous headroom so the top third of the frame stays empty for on-screen cards. Natural small hand gestures, steady locked-off camera, soft even key light, shallow depth of field. Background: ${BACKGROUND_PROMPT[background]}. Keep the person's face, hair, skin tone and glasses exactly as in the reference. No on-screen text, no captions, no logos, no other people, no camera movement.`
}

export const OMNIHUMAN_PROMPT =
  "The person speaks to camera as a calm, confident news presenter, natural subtle hand gestures, steady framing, no camera movement, no text on screen."

export const MUSIC_PROMPT = {
  calm: "Understated modern news-brief underscore: soft electric piano chords, light brushed percussion, subtle synth pulse, steady medium tempo around 95 BPM, trustworthy and optimistic, instrumental only, leaves space for a speaking voice, clean ending.",
  energetic:
    "Bright modern news-brief underscore: crisp electronic drums, plucked synth motif, warm bass, around 115 BPM, confident and forward-moving, instrumental only, leaves space for a speaking voice, clean ending.",
}

export const SFX = [
  { name: "sfx-whoosh", text: "short soft whoosh with a subtle click, clean UI transition, no reverb", seconds: 0.7 },
  { name: "sfx-pop", text: "gentle single pop, notification tick, soft, dry", seconds: 0.5 },
] as const
