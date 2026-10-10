"use client"

import { useEffect, useRef, useState } from "react"

import { ScriptEditor } from "@/components/studio/script-editor"
import { ErrorText, MonoLabel, SecondaryButton } from "@/components/studio/ui"
import type { Submission } from "@/lib/studio/admin"
import { useStudioUser } from "@/lib/studio/auth"
import { getScript, getStatus, poll, runStage, saveOptions, saveScript } from "@/lib/studio/sample/client"
import { audioCost, videoCost } from "@/lib/studio/sample/costs"
import type { Script, ScriptFile } from "@/lib/studio/sample/script"
import { blockers, STAGE_LABEL, STAGES, type SampleOptions, type SampleStatus, type Stage } from "@/lib/studio/sample/status"
import { cn } from "@/lib/utils"

const RUNNABLE: Stage[] = ["prep", "script", "voice", "video", "audio", "render"]

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

export function SamplePanel({ submission }: { submission: Submission }) {
  const user = useStudioUser()
  const id = submission.id
  const [status, setStatus] = useState<SampleStatus | null>(null)
  const [script, setScript] = useState<ScriptFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [notes, setNotes] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // While a provider job runs, ask the poll route every 5 s.
  const running = status ? STAGES.some((s) => status.stages[s].state === "running" && status.stages[s].job) : false
  useEffect(() => {
    if (!user || !running) return
    timer.current = setTimeout(() => {
      poll(user, id)
        .then(setStatus)
        .catch((e: Error) => setError(e.message))
    }, 5000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [user, id, running, status])

  if (!user) return null

  async function act<T>(key: Busy, work: () => Promise<T>): Promise<T | undefined> {
    setBusy(key)
    setError(null)
    try {
      return await work()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setBusy(null)
    }
  }

  const options = status?.options
  const setOption = (patch: Partial<SampleOptions>) => void act("options", async () => setStatus(await saveOptions(user, id, patch)))
  const run = (stage: Stage, body: Record<string, unknown> = {}) =>
    void act(stage, async () => {
      const next = await runStage(user, id, stage, body)
      setStatus(next)
      if (stage === "script") setScript(await getScript(user, id))
    })
  const onSaveScript = async (draft: Script, approved: boolean) => {
    const r = await saveScript(user, id, draft, approved)
    setStatus(r.status)
    setScript(r.script)
  }

  if (!status || !options) return <p className="m-0 text-[14px] text-stone-600">{error ?? "Loading sample…"}</p>

  const seconds = Math.min(30, Math.ceil(status.speechSeconds ?? 26) + 1)
  const spent = STAGES.reduce((n, s) => n + (status.stages[s].cost ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 border-t border-stone-200 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MonoLabel>Make sample</MonoLabel>
        <span className="text-[13px] text-stone-600">
          spent ${spent.toFixed(2)} · next video ≈ ${videoCost(options.method, seconds, options.lipsync).toFixed(2)} · audio ≈ $
          {audioCost(status.speechSeconds ?? 26).toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Method"
          value={options.method}
          onChange={(v) => setOption({ method: v as SampleOptions["method"] })}
          options={Object.entries(METHOD_HELP)}
        />
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
          label="Background (B)"
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
          <span className="text-[13px] text-stone-600">Face frame for B / C — pick the one with good light and a closed mouth</span>
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

      <ul className="m-0 flex list-none flex-col divide-y divide-stone-200 border border-stone-200 p-0 text-[14px]">
        {RUNNABLE.map((stage) => {
          const s = status.stages[stage]
          const reasons = blockers(status, stage)
          const blocked = busy !== null || s.state === "running" || reasons.length > 0
          return (
            <li key={stage} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 px-4 py-3">
              <span className="font-medium">{STAGE_LABEL[stage]}</span>
              <span className="flex min-w-0 flex-col">
                <span className={cn("truncate", s.state === "failed" && "text-[#c2410c]", s.state === "stale" && "text-amber-700")}>
                  {s.state}
                  {s.job?.step ? ` · ${s.job.step}` : ""}
                  {s.startedAt ? ` · ${elapsed(s)}` : ""}
                  {s.cost ? ` · $${s.cost.toFixed(2)}` : ""}
                </span>
                {s.error && <span className="truncate text-[13px] text-[#c2410c]">{s.error}</span>}
                {s.state !== "running" && reasons.length > 0 && <span className="truncate text-[13px] text-stone-500">{reasons.join(" ")}</span>}
              </span>
              <span className="flex gap-2">
                {stage === "script" && (
                  <SecondaryButton type="button" className="h-9 px-3 text-[13px]" disabled={blocked} onClick={() => run("script", { source: "gpt", notes })}>
                    GPT draft
                  </SecondaryButton>
                )}
                <SecondaryButton type="button" className="h-9 px-3 text-[13px]" disabled={blocked} onClick={() => run(stage)}>
                  {s.state === "done" || s.state === "stale" ? "Re-run" : s.state === "failed" ? "Retry" : "Run"}
                </SecondaryButton>
              </span>
            </li>
          )
        })}
      </ul>

      {status.stages.render.job?.provider === "local" && status.stages.render.state === "running" && (
        <p className="m-0 text-[13px] text-stone-600">
          No Remotion Lambda configured. On a dev machine: <code>STUDIO_ADMIN_TOKEN=… npm run sample:render -- {id}</code>; this page picks up
          final.mp4 when it lands.
        </p>
      )}

      <label className="flex flex-col gap-1 text-[14px]">
        <span className="text-stone-600">Notes for the GPT draft (only used by the GPT draft button)</span>
        <input
          className="h-10 border border-stone-950/16 px-3"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. use the latest draw, keep it under 70 words"
        />
      </label>

      {error && <ErrorText>{error}</ErrorText>}

      {script && <ScriptEditor key={script.createdAt + (script.editedAt ?? "")} file={script} busy={busy !== null} onSave={onSaveScript} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {status.assets["speech.mp3"] && (
          <div className="flex flex-col gap-1 text-[13px] text-stone-600">
            Speech {status.speechSeconds ? `(${status.speechSeconds}s)` : ""}
            <audio controls src={status.assets["speech.mp3"]} className="w-full" />
          </div>
        )}
        {status.assets["talking.mp4"] && (
          <div className="flex flex-col gap-1 text-[13px] text-stone-600">
            Talking video
            <video controls playsInline preload="metadata" src={status.assets["talking.mp4"]} className="max-h-[480px] w-full bg-stone-950 object-contain" />
          </div>
        )}
        {status.assets["final.mp4"] && (
          <div className="flex flex-col gap-1 text-[13px] text-stone-600">
            Final
            <video controls playsInline preload="metadata" src={status.assets["final.mp4"]} className="max-h-[480px] w-full bg-stone-950 object-contain" />
            <a href={status.assets["final.mp4"]} target="_blank" rel="noreferrer" className="underline">
              Open final.mp4
            </a>
          </div>
        )}
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
