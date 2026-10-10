import { blockers, type SampleStatus, type Stage } from "@/lib/studio/sample/status"

// The Generate button walks these in order; Send is its own step later.
export const AUTO_STAGES: Stage[] = ["prep", "script", "voice", "video", "audio", "render"]

export type AutoStep =
  | { kind: "run"; stage: Stage }
  | { kind: "retry"; stage: Stage }
  | { kind: "wait"; stage: Stage }
  | { kind: "blocked"; stage: Stage; reasons: string[] }
  | { kind: "done" }

// What Generate should do next: the first stage that isn't done, and whether
// it can start. Done stages are skipped, so after a re-run only the stale
// ones below it run again.
export function nextAutoStep(status: SampleStatus): AutoStep {
  for (const stage of AUTO_STAGES) {
    const state = status.stages[stage].state
    if (state === "done") continue
    if (state === "running") return { kind: "wait", stage }
    const reasons = blockers(status, stage)
    if (reasons.length) return { kind: "blocked", stage, reasons }
    return { kind: state === "failed" ? "retry" : "run", stage }
  }
  return { kind: "done" }
}
