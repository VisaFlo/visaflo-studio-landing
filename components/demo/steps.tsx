"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { Camera, Check, Play, ShieldCheck, Upload } from "lucide-react"

import {
  CAPTIONS,
  CTAS,
  LENGTHS,
  NEWS,
  THEMES,
  TONES,
  TOPICS,
  VISUALS,
  type CaptionId,
  type CtaId,
  type LengthId,
  type Severity,
  type Story,
  type ThemeId,
  type ToneId,
  type Topic,
  type VisualId,
} from "@/lib/demo/content"
import { cn } from "@/lib/utils"

export type RecState = "idle" | "recording" | "done"

const label = "font-mono text-[11px] tracking-[0.1em] text-stone-700 uppercase"
const selectedBorder = (on: boolean) => (on ? "border-2 border-stone-950" : "border border-stone-950/14")

function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[11px] tracking-[0.1em] text-stone-600 uppercase">{eyebrow}</div>
      <h1 className="mt-1.5 font-serif text-[44px] leading-[1.05] font-light tracking-[-0.025em]">{title}</h1>
      {children}
    </div>
  )
}

function Pill({
  on,
  locked,
  onClick,
  children,
  className,
}: {
  on: boolean
  locked?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={locked && !on}
      onClick={onClick}
      className={cn(
        "min-h-10 border border-stone-950 px-3.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-35",
        on ? "bg-stone-950 text-white" : "bg-white text-stone-950",
        className,
      )}
    >
      {children}
    </button>
  )
}

function DoneTag() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#3a4536]">
      <Check className="size-[13px]" strokeWidth={3} />
      Done
    </span>
  )
}

function SlotButton({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 flex-1 items-center justify-center gap-2 text-[15px]",
        primary ? "bg-stone-950 text-white hover:bg-stone-800" : "border border-stone-950/30 bg-transparent hover:border-stone-950",
      )}
    >
      {children}
    </button>
  )
}

function TextLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 px-2 text-[13px] text-stone-600 underline underline-offset-[3px] hover:text-stone-950">
      {children}
    </button>
  )
}

/* ---------- Step 1: face and voice ---------- */

export function FaceVoiceStep({
  firm,
  photo,
  onPhoto,
  onClearPhoto,
  rec,
  recSeconds,
  onStartRec,
  onStopRec,
  onUploadVideo,
  onClearVideo,
}: {
  firm: string
  photo: boolean
  onPhoto: () => void
  onClearPhoto: () => void
  rec: RecState
  recSeconds: number
  onStartRec: () => void
  onStopRec: () => void
  onUploadVideo: () => void
  onClearVideo: () => void
}) {
  const line = `“Hi, I'm with ${firm}. Every week I'll share what changed in Canadian immigration, in plain language, so you always know what it means for you.”`

  return (
    <div className="flex flex-col gap-7">
      <StepHeading eyebrow="Step 1 of 4" title="Your face and voice, once">
        <p className="mt-2.5 max-w-[560px] text-[15px] leading-normal text-stone-600">
          One photo and one short video. Every video after this uses them, so you never film again.
        </p>
      </StepHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col border border-stone-950/14 bg-white">
          <div className="flex items-center justify-between border-b border-stone-950/10 px-4 py-3.5">
            <span className={label}>1 · Portrait photo</span>
            {photo && <DoneTag />}
          </div>
          <div className="relative flex h-[280px] items-center justify-center overflow-hidden bg-stone-100">
            {photo ? (
              <div className="relative h-full w-[158px]">
                <Image src="/samples/alex-face.jpg" alt="Your portrait photo" fill sizes="158px" className="object-cover" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 px-6 text-center text-stone-600">
                <svg width="64" height="80" viewBox="0 0 64 80" fill="none" stroke="#a8a29e" strokeWidth="1.5" aria-hidden="true">
                  <rect x="1" y="1" width="62" height="78" strokeDasharray="4 4" />
                  <circle cx="32" cy="30" r="12" />
                  <path d="M12 72c2-12 10-18 20-18s18 6 20 18" />
                </svg>
                <span className="text-[13px] leading-[1.45]">
                  Vertical, face the camera,
                  <br />
                  shoulders in frame
                </span>
              </div>
            )}
          </div>
          <div className="mt-auto flex gap-2 p-3">
            {photo ? (
              <>
                <span className="flex-1 self-center text-[13px] text-stone-600">alex-photo.jpg · 1080×1920</span>
                <TextLink onClick={onClearPhoto}>Retake</TextLink>
              </>
            ) : (
              <>
                <SlotButton primary onClick={onPhoto}>
                  <Camera className="size-[17px]" strokeWidth={2} />
                  Take photo
                </SlotButton>
                <SlotButton onClick={onPhoto}>Upload</SlotButton>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col border border-stone-950/14 bg-white">
          <div className="flex items-center justify-between border-b border-stone-950/10 px-4 py-3.5">
            <span className={label}>2 · Portrait video</span>
            {rec === "done" && <DoneTag />}
          </div>
          <div className="relative h-[280px] overflow-hidden bg-stone-950 text-white">
            {rec === "idle" && (
              <div className="absolute inset-0 flex flex-col justify-center gap-3 px-[22px] py-5">
                <span className="font-mono text-[10px] tracking-[0.1em] text-stone-400 uppercase">
                  Film vertically while reading this · about 30 seconds
                </span>
                <p className="m-0 font-serif text-[19px] leading-[1.4]">{line}</p>
              </div>
            )}
            {rec !== "idle" && (
              <div className="absolute inset-y-0 left-1/2 w-[158px] -translate-x-1/2 overflow-hidden">
                <Image
                  src="/samples/alex-face.jpg"
                  alt={rec === "done" ? "Your portrait video" : ""}
                  fill
                  sizes="158px"
                  className={cn("object-cover", rec === "recording" && "opacity-75")}
                />
              </div>
            )}
            {rec === "recording" && (
              <>
                <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/60 px-2 py-1 font-mono text-[11px]">
                  <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-red-500" />
                  REC 0:{String(recSeconds).padStart(2, "0")}
                </div>
                <p className="absolute inset-x-4 bottom-4 m-0 bg-black/60 px-3 py-2.5 font-serif text-[17px] leading-[1.4]">
                  “Hi, I&apos;m with {firm}. Every week I&apos;ll share what changed in Canadian immigration…”
                </p>
              </>
            )}
            {rec === "done" && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 left-1/2 flex size-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-950"
                >
                  <Play className="ml-[3px] size-[18px]" fill="currentColor" strokeWidth={0} />
                </span>
                <span className="absolute bottom-2 left-1/2 ml-9 bg-black/70 px-1.5 py-0.5 font-mono text-[11px]">0:30</span>
              </>
            )}
          </div>
          <div className="mt-auto flex gap-2 p-3">
            {rec === "idle" && (
              <>
                <SlotButton primary onClick={onStartRec}>
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-red-500" />
                  Record now
                </SlotButton>
                <SlotButton onClick={onUploadVideo}>Upload video</SlotButton>
              </>
            )}
            {rec === "recording" && (
              <SlotButton onClick={onStopRec}>
                <span aria-hidden="true" className="size-2.5 bg-stone-950" />
                Stop
              </SlotButton>
            )}
            {rec === "done" && (
              <>
                <span className="flex-1 self-center text-[13px] text-stone-600">alex-video.mov · 0:30</span>
                <TextLink onClick={onClearVideo}>Redo</TextLink>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Step 2: branding ---------- */

export function BrandingStep({
  firm,
  onFirm,
  logoOn,
  onLogo,
  theme,
  onTheme,
  themeHex,
  caption,
  onCaption,
  visual,
  onVisual,
  locked = false,
}: {
  firm: string
  onFirm: (value: string) => void
  logoOn: boolean
  onLogo: (on: boolean) => void
  theme: ThemeId
  onTheme: (id: ThemeId) => void
  themeHex: string
  caption: CaptionId
  onCaption: (id: CaptionId) => void
  visual: VisualId
  onVisual: (id: VisualId) => void
  /** Keep the preset choices: the demo video was rendered with exactly these. */
  locked?: boolean
}) {
  return (
    <div className="flex flex-col gap-7">
      <StepHeading eyebrow="Step 2 of 4" title="Make it look like your firm" />

      <div>
        <label htmlFor="demo-firm" className={cn(label, "mb-3 block")}>
          Firm name
        </label>
        <input
          id="demo-firm"
          type="text"
          value={firm}
          onChange={(e) => onFirm(e.target.value)}
          readOnly={locked}
          placeholder="Your firm name"
          className="h-[52px] w-full rounded-none border border-stone-950/24 bg-white px-3.5 text-[16px] text-stone-950 outline-none focus:border-stone-950"
        />
        <p className="mt-2 mb-0 text-[13px] text-stone-600">Shown on the headline card in every video.</p>
      </div>

      <div>
        <div className={cn(label, "mb-3")}>Logo</div>
        {logoOn ? (
          <div className="flex h-24 items-center gap-3.5 border border-stone-950/16 bg-white p-4">
            <Image src="/visaflo-logo.png" alt="VisaFlo logo" width={56} height={56} className="block size-14" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">visaflo-logo.png</span>
              <span className="mt-0.5 block text-[13px] text-[#4d5a48]">Uploaded · 450×450</span>
            </span>
            <TextLink onClick={() => onLogo(false)}>Replace</TextLink>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onLogo(true)}
            className="flex h-24 w-full items-center justify-center gap-2.5 border-[1.5px] border-dashed border-stone-950/35 bg-white text-[14px] text-stone-700 hover:border-stone-950"
          >
            <Upload className="size-[22px]" strokeWidth={1.8} />
            <span>
              <strong>Upload logo</strong> · PNG or SVG
            </span>
          </button>
        )}
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className={cn(label, "mb-3")}>Theme color</legend>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === theme}
              aria-label={t.name}
              disabled={locked && t.id !== theme}
              onClick={() => onTheme(t.id)}
              className="flex w-[72px] flex-col items-center gap-1.5 text-[12px] text-stone-700 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span
                className="flex size-14 items-center justify-center text-white"
                style={{
                  background: t.hex,
                  boxShadow: t.id === theme ? "0 0 0 3px #faf9f6, 0 0 0 5px #1c1917" : "none",
                }}
              >
                {t.id === theme && <Check className="size-[18px]" strokeWidth={3} />}
              </span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className={cn(label, "mb-3")}>Captions</legend>
        <div className="grid grid-cols-3 gap-3">
          {CAPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === caption}
              disabled={locked && c.id !== caption}
              onClick={() => onCaption(c.id)}
              className={cn("bg-white p-0 text-left disabled:cursor-not-allowed disabled:opacity-35", selectedBorder(c.id === caption))}
            >
              <span className="flex h-[72px] items-center justify-center bg-stone-800">
                {c.id === "bold" && (
                  <span className="text-[16px] font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">New draw today</span>
                )}
                {c.id === "highlight" && (
                  <span className="text-[16px] font-bold text-white">
                    New{" "}
                    <span className="px-[5px] py-px" style={{ background: themeHex }}>
                      draw today
                    </span>
                  </span>
                )}
                {c.id === "boxed" && (
                  <span className="bg-white px-2 py-[3px] text-[15px] font-semibold text-stone-950">New draw today</span>
                )}
              </span>
              <span className="block px-3 py-2.5 text-[14px] font-semibold">{c.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className={cn(label, "mb-3")}>Visual style</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {VISUALS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === visual}
              disabled={locked && v.id !== visual}
              onClick={() => onVisual(v.id)}
              className={cn("bg-white p-0 text-left disabled:cursor-not-allowed disabled:opacity-35", selectedBorder(v.id === visual))}
            >
              <span className="relative block h-28 overflow-hidden bg-stone-600">
                {v.id === "newsroom" ? (
                  <span className="absolute inset-x-0 top-0 bg-[#111] px-2.5 py-2" style={{ borderBottom: `3px solid ${themeHex}` }}>
                    <span className="inline-block px-1 py-px font-mono text-[8px] tracking-[0.1em] text-white" style={{ background: themeHex }}>
                      UPDATE
                    </span>
                    <span className="mt-[3px] block text-[12px] font-bold text-white">New draw: CRS 518</span>
                  </span>
                ) : (
                  <span
                    className="absolute inset-x-3 top-3 rounded-lg px-2.5 py-2"
                    style={v.id === "clean" ? { background: "#ffffff" } : { background: themeHex }}
                  >
                    <span
                      className="block font-mono text-[8px] tracking-[0.1em]"
                      style={{ color: v.id === "clean" ? themeHex : "rgba(255,255,255,0.8)" }}
                    >
                      IRCC NOTICE
                    </span>
                    <span className={cn("mt-0.5 block text-[12px] font-bold", v.id === "clean" ? "text-stone-950" : "text-white")}>
                      New draw: CRS 518
                    </span>
                  </span>
                )}
              </span>
              <span className="block px-3 pt-2.5 pb-3">
                <span className="block text-[14px] font-semibold">{v.name}</span>
                <span className="mt-0.5 block text-[13px] text-stone-600">{v.description}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/* ---------- Step 3: news from Regulatory Monitor ---------- */

const severityStyle: Record<Severity, { ink: string; label: string }> = {
  high: { ink: "#c2410c", label: "High" },
  medium: { ink: "#8a5a00", label: "Medium" },
  low: { ink: "#57534e", label: "Low" },
}

export function NewsStep({
  topic,
  onTopic,
  storyId,
  onPick,
  locked = false,
}: {
  topic: "All" | Topic
  onTopic: (topic: "All" | Topic) => void
  storyId: string | null
  onPick: (id: string) => void
  locked?: boolean
}) {
  const shown = NEWS.filter((n) => topic === "All" || n.topic === topic)

  return (
    <div className="flex flex-col gap-5">
      <StepHeading eyebrow="Step 3 of 4 · From Regulatory Monitor" title="Pick this week's story">
        <div className="mt-2.5 flex items-center gap-2 text-[14px] text-stone-600">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#4d5a48]" />
          <span>Watching 40+ IRCC and provincial pages · Last checked 14 min ago</span>
        </div>
      </StepHeading>

      <div role="group" aria-label="Topic" className="flex flex-wrap gap-1.5 border-b border-stone-950/12 pb-3">
        {TOPICS.map((t) => {
          const count = t === "All" ? NEWS.length : NEWS.filter((n) => n.topic === t).length
          return (
            <button
              key={t}
              type="button"
              aria-pressed={t === topic}
              onClick={() => onTopic(t)}
              className={cn(
                "min-h-9 border border-stone-950/20 px-3.5 text-[13px]",
                t === topic ? "bg-stone-950 text-white" : "bg-white text-stone-950",
              )}
            >
              {t} <span className="ml-1 opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2.5">
        {shown.map((n) => {
          const sev = severityStyle[n.severity]
          const picked = n.id === storyId
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={picked}
              disabled={locked && !picked}
              onClick={() => onPick(n.id)}
              className={cn(
                "block w-full bg-white px-[18px] py-4 text-left disabled:cursor-not-allowed disabled:opacity-45",
                selectedBorder(picked),
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: sev.ink }}>
                  <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: sev.ink }} />
                  {sev.label}
                </span>
                {[n.topic, n.kind, n.jurisdiction].map((chip) => (
                  <span key={chip} className="border border-stone-950/20 px-2 py-0.5 text-[12px] text-stone-700">
                    {chip}
                  </span>
                ))}
                <span className="ml-auto text-[12px] text-stone-600">{n.detected}</span>
              </span>
              <span className="mt-2.5 block text-[17px] leading-[1.3] font-semibold">{n.title}</span>
              <span className="mt-1 block text-[14px] leading-normal text-stone-600">{n.summary}</span>
              <span className="mt-2.5 flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] tracking-[0.06em] text-stone-600">SOURCE · {n.source}</span>
                {picked && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-950">
                    <Check className="size-3.5" strokeWidth={3} />
                    In this video
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Step 4: script ---------- */

export function ScriptStep({
  story,
  tone,
  onTone,
  cta,
  onCta,
  length,
  onLength,
  script,
  onScript,
  writing,
  onGenerate,
  duration,
  words,
  locked = false,
}: {
  story: Story
  tone: ToneId
  onTone: (id: ToneId) => void
  cta: CtaId
  onCta: (id: CtaId) => void
  length: LengthId
  onLength: (id: LengthId) => void
  script: string | null
  onScript: (value: string) => void
  writing: boolean
  onGenerate: () => void
  duration: string
  words: number
  locked?: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading eyebrow="Step 4 of 4 · Script" title="Say it your way">
        <p className="mt-2.5 max-w-[600px] text-[15px] leading-normal text-stone-600">
          Choose how it should sound. We write it from the IRCC source, and you can edit every word.
        </p>
      </StepHeading>

      <div className="flex flex-wrap gap-x-10 gap-y-6">
        <fieldset className="m-0 border-0 p-0">
          <legend className={cn(label, "mb-2.5")}>Tone</legend>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <Pill key={t.id} on={t.id === tone} locked={locked} onClick={() => onTone(t.id)}>
                {t.name}
              </Pill>
            ))}
          </div>
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className={cn(label, "mb-2.5")}>Ending</legend>
          <div className="flex flex-wrap gap-1.5">
            {CTAS.map((c) => (
              <Pill key={c.id} on={c.id === cta} locked={locked} onClick={() => onCta(c.id)}>
                {c.name}
              </Pill>
            ))}
          </div>
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className={cn(label, "mb-2.5")}>Length</legend>
          <div className="flex flex-wrap gap-1.5">
            {LENGTHS.map((l) => (
              <Pill key={l.id} on={l.id === length} locked={locked} onClick={() => onLength(l.id)}>
                {l.name}
              </Pill>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={writing}
          className={cn(
            "inline-flex h-12 items-center gap-2.5 border border-stone-950 px-[22px] text-[15px]",
            script ? "bg-white text-stone-950" : "bg-stone-950 text-white",
          )}
        >
          {writing && (
            <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-stone-400/40 border-t-current" />
          )}
          {writing ? "Generating script…" : script ? "Regenerate script" : "Generate script"}
        </button>
      </div>

      {!script && !writing && (
        <div className="border-[1.5px] border-dashed border-stone-950/25 px-6 py-7 text-center text-[15px] text-stone-600">
          Pick a tone, ending and length, then generate your script.
        </div>
      )}
      {!script && writing && (
        <div className="flex flex-col gap-3 border border-stone-950/14 bg-white p-5">
          {["70%", "92%", "84%", "60%"].map((w) => (
            <span key={w} className="h-3.5 animate-pulse bg-stone-200" style={{ width: w }} />
          ))}
        </div>
      )}
      {script !== null && (
        <div className="border border-stone-950/14 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-950/10 px-4 py-3">
            <span className="text-[14px] font-semibold">{story.title}</span>
            <span className="font-mono text-[12px] text-stone-600">
              ≈ {duration} · {words} words
            </span>
          </div>
          <textarea
            aria-label="Script"
            value={script}
            onChange={(e) => onScript(e.target.value)}
            rows={10}
            className={cn(
              "block w-full resize-y rounded-none border-0 bg-white px-5 py-[18px] text-[17px] leading-[1.6] text-stone-950 outline-none",
              writing && "opacity-35",
            )}
          />
          <div className="flex items-center gap-2 border-t border-stone-950/10 px-4 py-3 text-[13px] text-stone-600">
            <ShieldCheck className="size-3.5" strokeWidth={2} />
            Facts checked against {story.source} on canada.ca
          </div>
        </div>
      )}
    </div>
  )
}
