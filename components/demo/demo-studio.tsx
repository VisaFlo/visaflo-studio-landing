"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Check, Download, Sparkles } from "lucide-react"

import { PhonePreview } from "@/components/demo/phone-preview"
import { BrandingStep, FaceVoiceStep, NewsStep, ScriptStep, type RecState } from "@/components/demo/steps"
import { Logo } from "@/components/landing/logo"
import { PrimaryButton, QuietButton, SecondaryButton } from "@/components/studio/ui"
import {
  buildScript,
  DEMO,
  estimateSeconds,
  formatDuration,
  NEWS,
  THEMES,
  TONES,
  VISUALS,
  type CaptionId,
  type CtaId,
  type LengthId,
  type ThemeId,
  type ToneId,
  type Topic,
  type VisualId,
} from "@/lib/demo/content"
import { cn } from "@/lib/utils"

// A click-through mock of VisaFlo Studio for the hook & demo video.
// Nothing is uploaded, written or rendered: every step only looks like it.
// The choices that shape the video are preset to DEMO and locked, so the
// finished video (a real render made for exactly those choices) matches.

type Step = 1 | 2 | 3 | 4

const STEP_NAMES = ["Face & voice", "Branding", "News", "Script"] as const
type Phase = "config" | "loading" | "done"

export function DemoStudio() {
  const [step, setStep] = useState<Step>(1)
  const [phase, setPhase] = useState<Phase>("config")

  const [photo, setPhoto] = useState(false)
  const [rec, setRec] = useState<RecState>("idle")
  const [recSeconds, setRecSeconds] = useState(0)

  const [firm, setFirm] = useState("VisaFlo Immigration")
  const [logoOn, setLogoOn] = useState(false)
  const [theme, setTheme] = useState<ThemeId>(DEMO.theme)
  const [caption, setCaption] = useState<CaptionId>(DEMO.caption)
  const [visual, setVisual] = useState<VisualId>(DEMO.visual)

  const [topic, setTopic] = useState<"All" | Topic>("All")
  const [storyId, setStoryId] = useState<string | null>(DEMO.storyId)

  const [tone, setTone] = useState<ToneId>(DEMO.tone)
  const [cta, setCta] = useState<CtaId>(DEMO.cta)
  const [length, setLength] = useState<LengthId>(DEMO.length)
  const [script, setScript] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)

  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)

  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (recTimer.current) clearInterval(recTimer.current)
    if (writeTimer.current) clearTimeout(writeTimer.current)
    if (renderTimer.current) clearInterval(renderTimer.current)
    if (doneTimer.current) clearTimeout(doneTimer.current)
  }
  useEffect(() => clearTimers, [])

  const story = NEWS.find((n) => n.id === storyId) ?? null
  const themeHex = THEMES.find((t) => t.id === theme)!.hex
  const firmShown = firm.trim() || "Your firm"
  const seconds = estimateSeconds(script ?? "")
  const duration = formatDuration(seconds)
  const words = (script ?? "").split(/\s+/).filter(Boolean).length

  const step1Ready = photo && rec === "done"
  const blocked = (step === 1 && !step1Ready) || (step === 3 && !story) || (step === 4 && (!script || writing))

  const summaries = [
    step1Ready ? "Photo and video ready" : photo ? "Photo ready · video next" : rec === "done" ? "Video ready · photo next" : "Photo and a 30-second video",
    `${firmShown} · ${THEMES.find((t) => t.id === theme)!.name} · ${VISUALS.find((v) => v.id === visual)!.name}`,
    story ? story.title : "Not picked yet",
    script ? `${TONES.find((t) => t.id === tone)!.name} · ≈ ${duration}` : story ? "Pick a style and length" : "After you pick a story",
  ]

  const startRec = () => {
    if (recTimer.current) clearInterval(recTimer.current)
    setRec("recording")
    setRecSeconds(0)
    let t = 0
    recTimer.current = setInterval(() => {
      t += 1
      if (t >= 30) {
        if (recTimer.current) clearInterval(recTimer.current)
        setRec("done")
      } else {
        setRecSeconds(t)
      }
    }, 140)
  }
  const stopRec = () => {
    if (recTimer.current) clearInterval(recTimer.current)
    setRec("done")
  }

  const pickStory = (id: string) => {
    if (id === storyId) return
    if (writeTimer.current) clearTimeout(writeTimer.current)
    setWriting(false)
    setStoryId(id)
    setScript(null)
  }

  const generateScript = () => {
    if (!storyId || writing) return
    setWriting(true)
    writeTimer.current = setTimeout(() => {
      setScript(buildScript(storyId, tone, cta, length))
      setWriting(false)
    }, 1300)
  }

  const generateVideo = () => {
    if (!script || writing) return
    setPhase("loading")
    setProgress(0)
    let p = 0
    renderTimer.current = setInterval(() => {
      p = Math.min(100, p + 1.4)
      setProgress(p)
      if (p >= 100) {
        if (renderTimer.current) clearInterval(renderTimer.current)
        doneTimer.current = setTimeout(() => setPhase("done"), 500)
      }
    }, 90)
  }

  const restart = () => {
    clearTimers()
    setPhase("config")
    setStep(4)
    setStoryId(DEMO.storyId)
    setScript(null)
    setWriting(false)
    setProgress(0)
    setCopied(false)
  }

  const goTo = (target: Step) => {
    if (target === 4 && !story) return
    setStep(target)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#faf9f6] font-sans text-stone-950">
      <header className="border-b border-stone-950/12 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1320px] flex-wrap items-center justify-between gap-x-6 px-(--page-pad)">
          <div className="flex flex-wrap items-center gap-x-9">
            <Logo />
            <nav aria-label="Studio" className="flex gap-6 text-[14px]">
              <span aria-current="page" className="border-b-2 border-stone-950 py-[21px] font-semibold">
                Create
              </span>
              <button type="button" className="py-[21px] text-stone-600 hover:text-stone-950">
                Library
              </button>
              <button type="button" className="py-[21px] text-stone-600 hover:text-stone-950">
                Regulatory Monitor
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-[14px] text-stone-700">
            <span>{firmShown}</span>
            <Image src="/visaflo-logo.png" alt="" width={32} height={32} className="block size-8" />
          </div>
        </div>
      </header>

      <main className="mx-auto box-border w-full max-w-[1320px] flex-1 px-(--page-pad) pt-7 pb-10">
        {phase === "config" && (
          <ol aria-label="Steps" className="m-0 mb-7 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
            {STEP_NAMES.map((name, i) => {
              const n = (i + 1) as Step
              return (
                <li key={name} className="flex">
                  <button type="button" onClick={() => goTo(n)} className="min-w-0 flex-1 text-left">
                    <span className={cn("block h-[3px]", n <= step ? "bg-stone-950" : "bg-stone-300")} />
                    <span className="flex items-baseline gap-2.5 pt-2.5">
                      <span className="font-mono text-[11px] tracking-[0.1em] text-stone-600">0{n}</span>
                      <span className={cn("text-[14px] font-semibold", n === step ? "text-stone-950" : "text-stone-600")}>
                        {name}
                      </span>
                    </span>
                    <span className="block truncate pt-0.5 pl-[26px] text-[13px] text-stone-600">{summaries[i]}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        <div className="flex flex-wrap items-start gap-10">
          <section className={cn("min-w-0 flex-[999_1_560px]", phase !== "done" && "max-w-[880px]")}>
            {phase === "config" && (
              <>
                {step === 1 && (
                  <FaceVoiceStep
                    firm={firmShown}
                    photo={photo}
                    onPhoto={() => setPhoto(true)}
                    onClearPhoto={() => setPhoto(false)}
                    rec={rec}
                    recSeconds={recSeconds}
                    onStartRec={startRec}
                    onStopRec={stopRec}
                    onUploadVideo={() => setRec("done")}
                    onClearVideo={() => {
                      setRec("idle")
                      setRecSeconds(0)
                    }}
                  />
                )}
                {step === 2 && (
                  <BrandingStep
                    firm={firm}
                    onFirm={setFirm}
                    logoOn={logoOn}
                    onLogo={setLogoOn}
                    theme={theme}
                    onTheme={setTheme}
                    themeHex={themeHex}
                    caption={caption}
                    onCaption={setCaption}
                    visual={visual}
                    onVisual={setVisual}
                    locked
                  />
                )}
                {step === 3 && <NewsStep topic={topic} onTopic={setTopic} storyId={storyId} onPick={pickStory} locked />}
                {step === 4 && story && (
                  <ScriptStep
                    story={story}
                    tone={tone}
                    onTone={setTone}
                    cta={cta}
                    onCta={setCta}
                    length={length}
                    onLength={setLength}
                    script={script}
                    onScript={setScript}
                    writing={writing}
                    onGenerate={generateScript}
                    duration={duration}
                    words={words}
                    locked
                  />
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stone-950/12 pt-5">
                  {step > 1 ? (
                    <SecondaryButton type="button" onClick={() => setStep((s) => (s - 1) as Step)} className="text-[15px] font-normal">
                      Back
                    </SecondaryButton>
                  ) : (
                    <span />
                  )}
                  {step < 4 ? (
                    <PrimaryButton
                      type="button"
                      aria-disabled={blocked}
                      onClick={() => !blocked && setStep((s) => (s + 1) as Step)}
                      className={cn("font-normal", blocked && "opacity-40")}
                    >
                      Continue
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton
                      type="button"
                      aria-disabled={blocked}
                      onClick={generateVideo}
                      className={cn("font-normal", blocked && "opacity-40")}
                    >
                      <Sparkles className="size-[18px]" strokeWidth={2} />
                      Generate video
                    </PrimaryButton>
                  )}
                </div>
              </>
            )}

            {phase === "loading" && (
              <div className="flex flex-col gap-7 pt-6">
                <div>
                  <div className="font-mono text-[11px] tracking-[0.1em] text-stone-600 uppercase">Making your video</div>
                  <h1 className="mt-1.5 font-serif text-[44px] leading-[1.05] font-light tracking-[-0.025em]">
                    Your video is on its way…
                  </h1>
                </div>
                <div>
                  <div className="mb-2 flex justify-end font-mono text-[14px] text-stone-700">{Math.round(progress)}%</div>
                  <div className="h-1.5 bg-stone-200">
                    <div className="h-1.5 bg-stone-950" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            )}

            {phase === "done" && story && (
              <div className="flex flex-col gap-6 pt-6">
                <div>
                  <div className="inline-flex items-center gap-2 bg-[#eef0e9] px-2.5 py-1.5 font-mono text-[11px] tracking-[0.1em] text-[#3a4536] uppercase">
                    <Check className="size-3" strokeWidth={3} />
                    Ready to post
                  </div>
                  <h1 className="mt-3 font-serif text-[44px] leading-[1.05] font-light tracking-[-0.025em]">{story.title}</h1>
                  <p className="mt-2.5 mb-0 text-[14px] text-stone-600">
                    {duration} · 1080×1920 · your face and voice · captions burned in
                  </p>
                </div>
                <div className="border border-stone-950/12 bg-white px-[18px] py-4">
                  <div className="mb-2 font-mono text-[11px] tracking-[0.1em] text-stone-600 uppercase">Post caption</div>
                  <p className="m-0 text-[15px] leading-[1.55]">{story.post}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={DEMO.video}
                    download="visaflo-immigration-work-permit.mp4"
                    className="flex h-[52px] items-center justify-center gap-2 bg-stone-950 px-8 text-[16px] text-white hover:bg-stone-800"
                  >
                    <Download className="size-[18px]" strokeWidth={2} />
                    Download video
                  </a>
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(story.post).then(() => setCopied(true))
                    }}
                    className="text-[15px] font-normal"
                  >
                    {copied ? "Copied" : "Copy caption"}
                  </SecondaryButton>
                  <QuietButton type="button" onClick={restart} className="text-[15px]">
                    Make another
                  </QuietButton>
                </div>
                <p className="m-0 text-[13px] text-stone-600">Saved to Library. Source: {story.source} (canada.ca)</p>
              </div>
            )}
          </section>

          {phase === "done" && (
            <aside aria-label="Your video" className="flex flex-[1_1_320px] flex-col items-center gap-3.5 lg:sticky lg:top-6">
              <div className="font-mono text-[11px] tracking-[0.1em] text-stone-600 uppercase">Your video</div>
              <PhonePreview videoSrc={DEMO.video} poster={DEMO.poster} duration={formatDuration(DEMO.videoSeconds)} />
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}
