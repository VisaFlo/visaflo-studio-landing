"use client"

import { useState } from "react"

import { ErrorText, SecondaryButton } from "@/components/studio/ui"
import type { Script, ScriptFile } from "@/lib/studio/sample/script"

const input = "h-10 w-full rounded-none border border-stone-950/16 bg-transparent px-3 text-[14px] outline-none focus:border-stone-950"
const area =
  "min-h-[64px] w-full rounded-none border border-stone-950/16 bg-transparent p-3 text-[14px] leading-[1.4] outline-none focus:border-stone-950"

// Lines, cards and sources side by side with the fact list, so the admin can
// check every number against its page before approving.
export function ScriptEditor({
  file,
  busy,
  onSave,
}: {
  file: ScriptFile
  busy: boolean
  onSave: (draft: Script, approved: boolean) => Promise<void>
}) {
  const [draft, setDraft] = useState<Script>(file.draft)
  const [error, setError] = useState<string | null>(null)
  const words = draft.lines.reduce(
    (n, l) =>
      n +
      l.tts_text
        .replace(/\[[^\]]*\]/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    0,
  )

  function setLine(i: number, key: "tts_text" | "caption_text", value: string) {
    setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }))
  }
  function setCard(i: number, patch: Partial<Script["cards"][number]>) {
    setDraft((d) => ({ ...d, cards: d.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  }
  async function save(approved: boolean) {
    setError(null)
    try {
      await onSave(draft, approved)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.")
    }
  }

  return (
    <div className="flex flex-col gap-5 border border-stone-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <input
          className={`${input} max-w-[560px] text-[16px] font-medium`}
          value={draft.headline}
          onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
          aria-label="Headline"
        />
        <span className="text-[13px] text-stone-600">
          {words} words · {file.model} · {file.approved ? "approved" : "draft"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <span className="hidden text-[12px] text-stone-500 lg:block">Spoken (what the voice reads)</span>
        <span className="hidden text-[12px] text-stone-500 lg:block">Caption (what viewers read)</span>
        {draft.lines.map((l, i) => (
          <div key={i} className="contents">
            <textarea className={area} value={l.tts_text} onChange={(e) => setLine(i, "tts_text", e.target.value)} aria-label={`Line ${i + 1} spoken`} />
            <textarea
              className={area}
              value={l.caption_text}
              onChange={(e) => setLine(i, "caption_text", e.target.value)}
              aria-label={`Line ${i + 1} caption`}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium">Cards (line · label · value · sub)</span>
        {draft.cards.map((c, i) => (
          <div key={i} className="grid grid-cols-[56px_1fr_120px_1fr_auto] gap-2">
            <input
              className={input}
              type="number"
              min={0}
              max={draft.lines.length - 1}
              value={c.line}
              onChange={(e) => setCard(i, { line: Number(e.target.value) })}
              aria-label={`Card ${i + 1} line`}
            />
            <input className={input} maxLength={28} value={c.label} onChange={(e) => setCard(i, { label: e.target.value })} aria-label={`Card ${i + 1} label`} />
            <input className={input} maxLength={12} value={c.value} onChange={(e) => setCard(i, { value: e.target.value })} aria-label={`Card ${i + 1} value`} />
            <input
              className={input}
              maxLength={40}
              value={c.sub ?? ""}
              onChange={(e) => setCard(i, { sub: e.target.value || null })}
              aria-label={`Card ${i + 1} sub`}
            />
            <button
              type="button"
              className="text-[13px] text-stone-600 underline"
              onClick={() => setDraft({ ...draft, cards: draft.cards.filter((_, j) => j !== i) })}
            >
              remove
            </button>
          </div>
        ))}
        {draft.cards.length < 4 && (
          <button
            type="button"
            className="self-start text-[13px] underline"
            onClick={() => setDraft({ ...draft, cards: [...draft.cards, { line: 0, label: "", value: "", sub: null }] })}
          >
            add card
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 text-[13px] text-stone-600 lg:grid-cols-2">
        <div>
          <div className="mb-1 font-medium text-stone-950">Sources</div>
          {draft.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block truncate underline">
              {s.title || s.url}
            </a>
          ))}
          {file.searchSources.length > 0 && <div className="mt-1">Searched {file.searchSources.length} canada.ca pages</div>}
        </div>
        <div>
          <div className="mb-1 font-medium text-stone-950">Facts to check</div>
          {draft.facts.map((f, i) => (
            <div key={i} className="truncate">
              {f.claim} —{" "}
              <a href={f.source_url} target="_blank" rel="noreferrer" className="underline">
                source
              </a>
            </div>
          ))}
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex flex-wrap gap-3">
        <SecondaryButton type="button" className="h-10 px-4 text-[14px]" disabled={busy} onClick={() => void save(false)}>
          Save draft
        </SecondaryButton>
        <SecondaryButton type="button" className="h-10 border-stone-950 px-4 text-[14px]" disabled={busy} onClick={() => void save(true)}>
          {file.approved ? "Save and keep approved" : "Approve for voice"}
        </SecondaryButton>
      </div>
    </div>
  )
}
