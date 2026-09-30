import Image from "next/image"
import { ArrowRight, Check } from "lucide-react"

const VOICE_BARS = [8, 14, 25, 18, 32, 23, 12, 27, 35, 20, 11, 24, 16, 8]

function IdentityScene() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#eeece7] p-7" aria-hidden="true">
      <div className="relative w-[184px]">
        <div className="relative aspect-square overflow-hidden">
          <Image
            src="/samples/alex-setup.jpeg"
            alt=""
            fill
            sizes="332px"
            className="origin-[55%_45%] scale-[1.8] object-cover object-[center_43%]"
          />
        </div>
        <div className="flex items-center justify-between bg-white px-3 py-3.5">
          <span className="text-[11px] font-medium">Your voice</span>
          <div className="flex h-5 items-center gap-[3px] text-stone-800">
            {VOICE_BARS.map((height, index) => (
              <span key={index} className="w-[2px] bg-current" style={{ height: height * 0.55 }} />
            ))}
          </div>
        </div>
        <div className="absolute -right-6 -top-4 flex gap-1 border border-stone-200 bg-white p-2.5 shadow-[0_3px_12px_#1c19170a]">
          <span className="size-5 bg-stone-950" />
          <span className="size-5 bg-[#8c9a88]" />
          <span className="size-5 bg-[#f0e8d7]" />
        </div>
      </div>
    </div>
  )
}

function ScriptScene() {
  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-[#f2f0eb] px-6 pt-7" aria-hidden="true">
      <div className="flex h-full w-full max-w-[250px] flex-col border-x border-t border-stone-200 bg-white p-5 shadow-[0_4px_18px_#1c191706]">
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-3 font-mono text-[9px] tracking-[0.08em] text-stone-500 uppercase">
          <span>Example script</span>
          <span>01</span>
        </div>
        <p className="mt-5 font-serif text-[31px] leading-[1.08] tracking-[-0.025em]">
          Studying on<br />a work permit?
        </p>
        <div className="mt-4 space-y-2 text-[12px] leading-[1.5] text-stone-600">
          <p><span className="bg-[#eef0e9] px-1">Two checks before you start.</span></p>
          <p>Here’s what to know.</p>
        </div>
        <div className="mt-auto flex items-center gap-2 border-t border-stone-200 py-4 text-[10px] text-stone-500">
          <span className="size-1.5 bg-stone-950" />
          Source included for your review
        </div>
      </div>
    </div>
  )
}

function VideoScene() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#e8e6e1] px-6 py-5">
      <video
        controls
        muted
        playsInline
        preload="none"
        poster="/samples/work-permit-study-selfie.jpg"
        aria-label="Play an example finished work permit study video"
        className="aspect-[9/16] h-full max-w-full bg-stone-900 object-cover shadow-[0_8px_20px_#1c191712]"
      >
        <source src="/samples/work-permit-study-selfie.mp4" type="video/mp4" />
      </video>
      <div aria-hidden="true" className="pointer-events-none absolute left-5 top-6 flex items-center gap-1.5 bg-white px-2.5 py-2 text-[10px] font-medium shadow-[0_3px_12px_#1c19170a]">
        <Check className="size-3" strokeWidth={1.5} />
        Your final say
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: "Set up once.",
    body: "Add your face, voice and firm’s branding.",
    Scene: IdentityScene,
  },
  {
    title: "We do the drafting.",
    body: "Get short scripts from the latest immigration news.",
    Scene: ScriptScene,
  },
  {
    title: "Review. Post. Repeat.",
    body: "Approve the script. Download your video. Share it.",
    Scene: VideoScene,
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-20 py-16 md:py-24 lg:py-28">
      <div className="mx-auto max-w-[1360px] px-(--page-pad)">
        <div className="mb-9 md:mb-12">
          <p className="mb-5 font-mono text-[11px] tracking-[0.12em] text-stone-500 uppercase">How it works</p>
          <h2 id="how-it-works-heading" className="font-serif text-[clamp(38px,4.5vw,62px)] leading-[1.04] font-light tracking-[-0.025em]">
            Set up once. <span className="text-stone-500">Show up often.</span>
          </h2>
          <p className="mt-5 flex items-center gap-2 text-[12px] text-stone-500 md:hidden">
            Swipe through the steps <ArrowRight size={14} aria-hidden="true" />
          </p>
        </div>

        <ol tabIndex={0} aria-label="Three steps to your next video" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-400 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0 lg:gap-7">
          {STEPS.map(({ title, body, Scene }, index) => (
            <li key={title} className="w-[86%] min-w-0 shrink-0 snap-start md:w-auto">
              <div className="h-[280px] lg:h-[300px]">
                <Scene />
              </div>
              <div className="mt-6 flex items-start gap-4 border-t border-stone-300 pt-5">
                <span aria-hidden="true" className="shrink-0 font-serif text-[46px] leading-[0.95] font-light tracking-[-0.04em] text-stone-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="pt-0.5">
                  <h3 className="font-serif text-[clamp(24px,2.3vw,31px)] leading-[1.08] tracking-[-0.02em]">{title}</h3>
                  <p className="mt-3 max-w-[285px] text-[14px] leading-[1.6] text-stone-600">{body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-stone-300 pt-7 md:mt-12">
          <p className="text-[14px] text-stone-600">No weekly shoot. No blank page.</p>
          <a href="#waitlist" className="inline-flex min-h-11 items-center gap-4 text-[14px] font-medium underline decoration-stone-300 underline-offset-4 transition-colors hover:decoration-stone-950 focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none">
            Get my sample video
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

export { HowItWorks }
