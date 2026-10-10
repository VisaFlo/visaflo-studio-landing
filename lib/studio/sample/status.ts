// status.json for one sample: which stages ran, what they produced, what
// they cost. Pure functions so the routes stay thin and this stays testable.
export const STAGES = ["prep", "script", "voice", "video", "audio", "render", "send"] as const
export type Stage = (typeof STAGES)[number]

export type Method = "real" | "scene" | "portrait"
export type Background = "office" | "studio" | "street"
export type LipsyncModel = "standard" | "pro"

export type SampleOptions = {
  method: Method
  background: Background
  layout: "boxed" | "full"
  mood: "calm" | "energetic"
  /** sync lipsync-2 (standard, $3/min) or lipsync-2-pro ($5/min). */
  lipsync: LipsyncModel
  /** 1–5, which face-N.jpg to use for scene and portrait. */
  faceFrame?: number
  /** Method real: seconds into the recording where the clip starts. */
  clipStart: number
}

export type StageJob = {
  provider: "fal" | "higgsfield" | "remotion" | "local"
  id: string
  step?: "scene" | "lipsync"
  statusUrl?: string
  responseUrl?: string
  bucketName?: string
}

export type StageState = {
  state: "idle" | "running" | "done" | "failed" | "stale"
  job?: StageJob
  error?: string
  startedAt?: string
  finishedAt?: string
  cost?: number
}

export type SampleStatus = {
  version: 1
  options: SampleOptions
  voiceId?: string
  speechSeconds?: number
  recordingSeconds?: number
  scriptApproved?: boolean
  /** file name under sample/ → public media URL (download token) */
  assets: Record<string, string>
  stages: Record<Stage, StageState>
}

export const STAGE_LABEL: Record<Stage, string> = {
  prep: "Prep",
  script: "Script",
  voice: "Voice",
  video: "Video",
  audio: "Audio",
  render: "Render",
  send: "Send",
}

export const DEPENDS: Record<Stage, Stage[]> = {
  prep: [],
  script: [],
  voice: ["prep", "script"],
  video: ["voice"],
  audio: ["voice"],
  render: ["video", "audio"],
  send: ["render"],
}

export const TIMEOUT_MINUTES: Record<Stage, number> = {
  prep: 5,
  script: 5,
  voice: 5,
  video: 15,
  audio: 5,
  render: 10,
  send: 5,
}

export function defaultStatus(): SampleStatus {
  return {
    version: 1,
    options: { method: "real", background: "office", layout: "boxed", mood: "calm", lipsync: "pro", clipStart: 15 },
    assets: {},
    stages: Object.fromEntries(STAGES.map((s) => [s, { state: "idle" }])) as Record<Stage, StageState>,
  }
}

export function blockers(status: SampleStatus, stage: Stage): string[] {
  const out: string[] = []
  if (status.stages[stage].state === "running") return [`${STAGE_LABEL[stage]} is already running.`]
  for (const dep of DEPENDS[stage]) {
    const state = status.stages[dep].state
    if (state === "stale") out.push(`Run ${STAGE_LABEL[dep]} again first.`)
    else if (state !== "done") out.push(`Run ${STAGE_LABEL[dep]} first.`)
  }
  if (stage === "voice" && !status.scriptApproved) out.push("Approve the script first.")
  if (stage === "video" && status.options.method !== "real" && !status.options.faceFrame) out.push("Pick a face frame first.")
  return out
}

function patchStage(status: SampleStatus, stage: Stage, patch: StageState): SampleStatus {
  return { ...status, stages: { ...status.stages, [stage]: patch } }
}

export function startStage(status: SampleStatus, stage: Stage, now = new Date()): SampleStatus {
  let next = patchStage(status, stage, { state: "running", startedAt: now.toISOString() })
  // Anything built on this stage's old output is now out of date.
  for (const later of STAGES.slice(STAGES.indexOf(stage) + 1)) {
    if (next.stages[later].state === "done") next = patchStage(next, later, { ...next.stages[later], state: "stale" })
  }
  if (stage === "script") next = { ...next, scriptApproved: false }
  return next
}

export function setJob(status: SampleStatus, stage: Stage, job: StageJob): SampleStatus {
  return patchStage(status, stage, { ...status.stages[stage], job })
}

export type StagePatch = { cost?: number } & Partial<
  Pick<SampleStatus, "voiceId" | "speechSeconds" | "recordingSeconds" | "scriptApproved" | "assets">
>

export function finishStage(status: SampleStatus, stage: Stage, patch: StagePatch = {}, now = new Date()): SampleStatus {
  const { cost, assets, ...rest } = patch
  const prev = status.stages[stage]
  return {
    ...patchStage(status, stage, {
      state: "done",
      startedAt: prev.startedAt,
      finishedAt: now.toISOString(),
      ...(cost !== undefined ? { cost } : prev.cost !== undefined ? { cost: prev.cost } : {}),
    }),
    ...rest,
    assets: { ...status.assets, ...(assets ?? {}) },
  }
}

export function failStage(status: SampleStatus, stage: Stage, error: string, now = new Date()): SampleStatus {
  const prev = status.stages[stage]
  return patchStage(status, stage, {
    state: "failed",
    startedAt: prev.startedAt,
    finishedAt: now.toISOString(),
    error: error.slice(0, 400),
    ...(prev.cost !== undefined ? { cost: prev.cost } : {}),
  })
}

export function timedOut(state: StageState, now: Date, stage: Stage): boolean {
  if (state.state !== "running" || !state.startedAt) return false
  return now.getTime() - Date.parse(state.startedAt) > TIMEOUT_MINUTES[stage] * 60_000
}
