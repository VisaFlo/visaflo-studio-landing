"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { ScriptEditor } from "@/components/studio/script-editor"
import { ErrorText, MonoLabel, PrimaryButton, QuietButton, SecondaryButton } from "@/components/studio/ui"
import type { Submission } from "@/lib/studio/admin"
import { useStudioUser } from "@/lib/studio/auth"
import { AUTO_STAGES, nextAutoStep } from "@/lib/studio/sample/auto"
import { getScript, getStatus, poll, runStage, saveOptions, saveScript } from "@/lib/studio/sample/client"
import { audioCost, videoCost } from "@/lib/studio/sample/costs"
import type { Script, ScriptFile } from "@/lib/studio/sample/script"
import { STAGE_LABEL, STAGES, type SampleOptions, type SampleStatus, type Stage } from "@/lib/studio/sample/status"
import { cn } from "@/lib/utils"

const STAGE_HELP: Record<Stage, string> = {
  prep: "Voice sample and five face frames from the recording",
  script: "This topic's fixed script (or a GPT draft)",
  voice: "Clone the voice, speak the script",
  video: "Lip-sync their footage, or generate the scene",
  audio: "Music bed and card sounds",
  render: "Captions, cards and mix → final.mp4",
  send: "Email the result",
}

const METHOD_HELP: Record<SampleOptions["method"], string> = {
  real: "A · their own recording, lips re-synced",
  scene: "B · Higgsfield scene from a face frame, lips re-synced",
  portrait: "C · OmniHuman from a face frame",
}

function elapsed(s: { startedAt?: string; finishedAt?: string }): string {
  if (!s.startedAt) return ""
  const end = s.finishedAt ? Date.parse(s.finishedAt) : Date.now()
  const sec = Math.max(0, Math.round((end - Date.parse(s.startedAt)) / 1000))
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`
}

type Busy = Stage | "options" | "script" | null

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border border-stone-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MonoLabel>{title}</MonoLabel>
        {aside && <span className="text-[13px] text-stone-600">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

export function SamplePanel({ submission }: { submission: Submission }) {
  const user = useStudioUser()
  const id = submission.id
  const [status, setStatus] = useState<SampleStatus | null>(null)
  const [script, setScript] = useState<ScriptFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  // Generate pressed: keep starting the next stage until done, blocked or
  // failed. The ref is what the async chain reads; the state is for the UI.
  const autoRef = useRef(false)
  const [auto, setAuto] = useState(false)
  const [tick, setTick] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const polling = useRef(false)

  const stopAuto = useCallback(() => {
    autoRef.current = false
    setAuto(false)
  }, [])

  const act = useCallback(
    async <T,>(key: Busy, work: () => Promise<T>): Promise<T | undefined> => {
      setBusy(key)
      setError(null)
      try {
        return await work()
      } catch (e) {
        stopAuto()
        setError(e instanceof Error ? e.message : "Something went wrong.")
      } finally {
        setBusy(null)
      }
    },
    [stopAuto],
  )

  const runOnce = useCallback(
    (stage: Stage, body: Record<string, unknown> = {}) =>
      act(stage, async () => {
        if (!user) return
        const next = await runStage(user, id, stage, body)
        setStatus(next)
        if (stage === "script") setScript(await getScript(user, id))
        return next
      }),
    [act, user, id],
  )

  // With Generate on, start the next stage each time one finishes. Stages
  // that finish inside the request (Prep, Script, Voice, Audio) chain here;
  // ones that leave a provider job running (Video, Render) hand over to the
  // poll loop, which calls this again with each new status. A failed stage,
  // a missing face frame or an unapproved draft ends the run.
  const continueAuto = useCallback(
    async (from: SampleStatus | undefined) => {
      let s = from
      while (autoRef.current && s) {
        const step = nextAutoStep(s)
        if (step.kind === "wait") return
        if (step.kind !== "run") return stopAuto()
        s = await runOnce(step.stage)
      }
    },
    [runOnce, stopAuto],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getStatus(user, id), getScript(user, id)])
      .then(([s, sc]) => {
        if (cancelled) return
        setStatus(s)
        setScript(sc)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [user, id])

  // While a stage is running (a provider job, or a run that may have died),
  // ask the poll route every 5 s. One poll in flight at a time; an error
  // doesn't stop the loop.
  const running = status ? STAGES.some((s) => status.stages[s].state === "running") : false
  useEffect(() => {
    if (!user || !running) return
    timer.current = setTimeout(() => {
      if (polling.current) return
      polling.current = true
      poll(user, id)
        .then((s) => {
          setStatus(s)
          void continueAuto(s)
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => {
          polling.current = false
          setTick((n) => n + 1)
        })
    }, 5000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [user, id, running, status, tick, continueAuto])

  if (!user) return null

  const run = (stage: Stage, body: Record<string, unknown> = {}) => void runOnce(stage, body)
  const options = status?.options
  const setOption = (patch: Partial<SampleOptions>) => void act("options", async () => setStatus(await saveOptions(user, id, patch)))
  const onSaveScript = async (draft: Script, approved: boolean) => {
    const r = await saveScript(user, id, draft, approved)
    setStatus(r.status)
    setScript(r.script)
  }

  if (!status || !options) return <p className="m-0 text-[14px] text-stone-600">{error ?? "Loading sample…"}</p>

  const seconds = Math.min(30, Math.ceil(status.speechSeconds ?? 26) + 1)
  const spent = STAGES.reduce((n, s) => n + (status.stages[s].cost ?? 0), 0)
  const done = AUTO_STAGES.filter((s) => status.stages[s].state === "done").length
  const step = nextAutoStep(status)
  const generating = auto
  const current = step.kind === "done" ? null : step.stage
  const currentIndex = current ? AUTO_STAGES.indexOf(current) : AUTO_STAGES.length

  function generate() {
    if (step.kind !== "run" && step.kind !== "retry") return
    autoRef.current = true
    setAuto(true)
    void runOnce(step.stage).then(continueAuto)
  }

  const generateLabel = generating
    ? `Generating… ${currentIndex + 1} of ${AUTO_STAGES.length} · ${current ? STAGE_LABEL[current] : ""}`
    : step.kind === "done"
      ? "All done"
      : step.kind === "wait"
        ? `Running ${STAGE_LABEL[step.stage]}…`
        : step.kind === "retry"
          ? `Retry ${STAGE_LABEL[step.stage]}`
          : done > 0
            ? "Continue"
            : "Generate"
  const canGenerate = !auto && busy === null && (step.kind === "run" || step.kind === "retry")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-stone-200 pt-6">
        <h2 className="m-0 text-[22px] font-medium tracking-[-0.01em]">Make the sample</h2>
        <span className="text-[14px] text-stone-600">
          {done} of {AUTO_STAGES.length} steps done · spent ${spent.toFixed(2)}
        </span>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: how to make it, and the steps */}
        <div className="flex flex-col gap-6">
          <Section title="Settings" aside={`next video ≈ $${videoCost(options.method, seconds, options.lipsync).toFixed(2)} · audio ≈ $${audioCost(status.speechSeconds ?? 26).toFixed(2)}`}>
            <div className="grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-2">
              <Select label="Method" value={options.method} onChange={(v) => setOption({ method: v as SampleOptions["method"] })} options={Object.entries(METHOD_HELP)} />
              <Select
                label="Lipsync model"
                value={options.lipsync}
                onChange={(v) => setOption({ lipsync: v as SampleOptions["lipsync"] })}
                options={[
                  ["pro", "lipsync-2-pro ($5/min)"],
                  ["standard", "lipsync-2 ($3/min)"],
                ]}
                disabled={options.method === "portrait"}
              />
              <Select
                label="Background (B only)"
                value={options.background}
                onChange={(v) => setOption({ background: v as SampleOptions["background"] })}
                options={[
                  ["office", "Office"],
                  ["studio", "Studio"],
                  ["street", "Street"],
                ]}
                disabled={options.method !== "scene"}
              />
              <Select
                label="Layout"
                value={options.layout}
                onChange={(v) => setOption({ layout: v as SampleOptions["layout"] })}
                options={[
                  ["boxed", "Boxed 16:9 in frame"],
                  ["full", "Full 9:16"],
                ]}
              />
              <Select
                label="Music"
                value={options.mood}
                onChange={(v) => setOption({ mood: v as SampleOptions["mood"] })}
                options={[
                  ["calm", "Calm"],
                  ["energetic", "Energetic"],
                ]}
              />
              {options.method === "real" && (
                <label className="flex flex-col gap-1">
                  <span className="text-stone-600">Clip starts at (s)</span>
                  <input
                    type="number"
                    min={0}
                    max={170}
                    className="h-10 border border-stone-950/16 px-3"
                    defaultValue={options.clipStart}
                    onBlur={(e) => setOption({ clipStart: Number(e.target.value) })}
                  />
                </label>
              )}
            </div>

            {status.stages.prep.state === "done" && options.method !== "real" && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-stone-600">Face frame — pick the one with good light and a closed mouth</span>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOption({ faceFrame: n })}
                      className={cn("border-2", options.faceFrame === n ? "border-stone-950" : "border-transparent")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={status.assets[`face-${n}.jpg`]} alt={`Frame ${n}`} className="aspect-video w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title="Generate" aside="six steps, run in order; redoing one redoes what was built on it">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <PrimaryButton type="button" className="h-11 px-6 text-[15px]" disabled={!canGenerate} onClick={generate}>
                  {generateLabel}
                </PrimaryButton>
                {generating && (
                  <QuietButton type="button" className="h-11" onClick={stopAuto}>
                    Stop after this step
                  </QuietButton>
                )}
                {step.kind === "blocked" && <span className="text-[13px] text-amber-700">{step.reasons.join(" ")} Then press Continue.</span>}
                {step.kind === "retry" && !generating && status.stages[step.stage].error && (
                  <span className="text-[13px] text-[#c2410c]">{STAGE_LABEL[step.stage]} failed. Retry picks up from there.</span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1" aria-hidden>
                {AUTO_STAGES.map((stage) => {
                  const state = status.stages[stage].state
                  return (
                    <span
                      key={stage}
                      className={cn(
                        "h-1",
                        state === "done" && "bg-stone-950",
                        state === "running" && "animate-pulse bg-amber-400",
                        state === "failed" && "bg-[#c2410c]",
                        state === "stale" && "bg-amber-200",
                        state === "idle" && "bg-stone-200",
                      )}
                    />
                  )
                })}
              </div>
            </div>

            <ol className="m-0 flex list-none flex-col divide-y divide-stone-200 p-0 text-[14px]">
              {AUTO_STAGES.map((stage, i) => {
                const s = status.stages[stage]
                const redoable = (s.state === "done" || s.state === "stale") && busy === null && !running
                return (
                  <li key={stage} className="grid grid-cols-[28px_1fr_auto] items-start gap-3 py-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium",
                        s.state === "done" && "bg-stone-950 text-white",
                        s.state === "running" && "bg-amber-400 text-stone-950",
                        s.state === "failed" && "bg-[#c2410c] text-white",
                        s.state === "stale" && "bg-amber-100 text-amber-800",
                        s.state === "idle" && "bg-stone-100 text-stone-500",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">
                        {STAGE_LABEL[stage]}
                        <span className={cn("ml-2 text-[12px] font-normal", s.state === "failed" ? "text-[#c2410c]" : s.state === "stale" ? "text-amber-700" : "text-stone-500")}>
                          {s.state === "idle" ? "waiting" : s.state}
                          {s.job?.step ? ` · ${s.job.step}` : ""}
                          {s.startedAt ? ` · ${elapsed(s)}` : ""}
                          {s.cost ? ` · $${s.cost.toFixed(2)}` : ""}
                        </span>
                      </span>
                      <span className="text-[13px] text-stone-600">{STAGE_HELP[stage]}</span>
                      {s.error && <span className="text-[13px] text-[#c2410c]">{s.error}</span>}
                      {stage === "render" && s.job?.provider === "local" && s.state === "running" && (
                        <span className="text-[13px] text-stone-600">
                          {s.job.id.startsWith("pid:")
                            ? "Rendering with Chrome on this machine, usually 1–3 minutes."
                            : <>No Remotion Lambda configured. On a dev machine: <code>STUDIO_ADMIN_TOKEN=… npm run sample:render -- {id}</code></>}
                        </span>
                      )}
                    </span>
                    {redoable && (
                      <QuietButton type="button" className="h-6 text-[13px]" onClick={() => run(stage)}>
                        Redo
                      </QuietButton>
                    )}
                  </li>
                )
              })}
            </ol>
          </Section>
        </div>

        {/* Right: the script and what came out */}
        <div className="flex flex-col gap-6">
          <Section
            title="Script"
            aside={
              <span className="flex items-center gap-3">
                {script ? `${script.model} · ${script.approved ? "approved" : "draft, approve before Voice"}` : "appears after step 2"}
                <SecondaryButton
                  type="button"
                  className="h-8 px-3 text-[13px]"
                  disabled={busy !== null || running}
                  onClick={() => run("script", { source: "gpt" })}
                  title="Ask GPT-6 Sol for a fresh script from this week's canada.ca pages. You approve it before Voice runs."
                >
                  GPT draft
                </SecondaryButton>
              </span>
            }
          >
            {script ? (
              <ScriptEditor key={script.createdAt + (script.editedAt ?? "")} file={script} busy={busy !== null} onSave={onSaveScript} />
            ) : (
              <p className="m-0 text-[14px] text-stone-500">The topic&apos;s script appears here after step 2. Edit or approve it any time; Voice re-runs from the saved text.</p>
            )}
          </Section>

          <Section title="Outputs">
            {!status.assets["speech.mp3"] && !status.assets["talking.mp4"] && !status.assets["final.mp4"] && (
              <p className="m-0 text-[14px] text-stone-500">Nothing yet. Speech, the talking video and the final cut show up here.</p>
            )}
            {status.assets["speech.mp3"] && (
              <div className="flex flex-col gap-1 text-[13px] text-stone-600">
                Speech {status.speechSeconds ? `(${status.speechSeconds}s)` : ""}
                <audio controls src={status.assets["speech.mp3"]} className="w-full" />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {status.assets["talking.mp4"] && (
                <div className="flex flex-col gap-1 text-[13px] text-stone-600">
                  Talking video
                  <video controls playsInline preload="metadata" src={status.assets["talking.mp4"]} className="max-h-[520px] w-full bg-stone-950 object-contain" />
                </div>
              )}
              {status.assets["final.mp4"] && (
                <div className="flex flex-col gap-1 text-[13px] text-stone-600">
                  Final
                  <video controls playsInline preload="metadata" src={status.assets["final.mp4"]} className="max-h-[520px] w-full bg-stone-950 object-contain" />
                  <a href={status.assets["final.mp4"]} target="_blank" rel="noreferrer" className="underline">
                    Open final.mp4
                  </a>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-stone-600">{label}</span>
      <select className="h-10 border border-stone-950/16 bg-white px-2" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
