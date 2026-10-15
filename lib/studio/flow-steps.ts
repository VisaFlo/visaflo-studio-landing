// /start's screens, the five steps of its header, and which steps can be
// opened again.

export type Step =
  | "loading"
  | "about"
  | "camera"
  | "blocked"
  | "photo-guide"
  | "photo"
  | "photo-review"
  | "video-guide"
  | "align"
  | "countdown"
  | "script"
  | "review"
  | "topic"
  | "submit"
  | "done"

/** The camera screen the camera is being opened for. */
export type CameraFor = "photo" | "align"

export const STEPS = ["Tell us about you", "Take a photo", "Take a video", "Pick a topic", "Submit"] as const

/** The header step a screen belongs to (5: done, past the last one). */
export function stepIndex(step: Step, cameraFor: CameraFor): number {
  switch (step) {
    case "loading":
    case "about":
      return 0
    case "camera":
    case "blocked":
      return cameraFor === "photo" ? 1 : 2
    case "photo-guide":
    case "photo":
    case "photo-review":
      return 1
    case "video-guide":
    case "align":
    case "countdown":
    case "script":
    case "review":
      return 2
    case "topic":
      return 3
    case "submit":
      return 4
    case "done":
      return 5
  }
}

// `reached` is the furthest step reached; the header opens any step up to
// it. Visiting a screen raises it (never past Submit). A new photo or a new
// take lowers it to the video step, so Pick a topic and Submit can't be
// opened until the take is submitted again: the request must not go out with
// the upload of the photo or take that was replaced.
export function reachedOnVisit(reached: number, at: number): number {
  return Math.max(reached, Math.min(4, at))
}

export function reachedAfterNewPhoto(reached: number, hasRecording: boolean): number {
  return Math.min(reached, hasRecording ? 2 : 1)
}

export function reachedAfterNewTake(reached: number): number {
  return Math.min(reached, 2)
}

/**
 * How header step `i` shows, and whether it opens: any step up to `reached`
 * other than the current one, unless the flow is `busy` (recording, sending,
 * or sent).
 */
export function headerStep(i: number, at: number, reached: number, busy: boolean): { state: "done" | "current" | "todo"; open: boolean } {
  return {
    state: i === at ? "current" : i < at || i <= reached ? "done" : "todo",
    open: !busy && i !== at && i <= reached,
  }
}
