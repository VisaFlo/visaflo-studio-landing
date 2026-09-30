import type { ReactNode } from "react"
import Image from "next/image"
import { ArrowRight, Check, Download, Link2, Mic, Upload } from "lucide-react"

const PLATFORMS = [
  {
    name: "TikTok",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
  {
    name: "Instagram",
    path: "M7 0C3.134 0 0 3.134 0 7v10c0 3.866 3.134 7 7 7h10c3.866 0 7-3.134 7-7V7c0-3.866-3.134-7-7-7H7zm0 2h10c2.761 0 5 2.239 5 5v10c0 2.761-2.239 5-5 5H7c-2.761 0-5-2.239-5-5V7c0-2.761 2.239-5 5-5zm11 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  },
  {
    name: "YouTube",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    name: "LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
]

// The script of the finished sample video below, line by line with its timing.
const SCRIPT = [
  ["0:00", "Okay, this one’s big."],
  ["0:03", "Starting this month, eligible work permit holders can study a program of up to six months,"],
  ["0:09", "no separate study permit needed."],
  ["0:12", "Two things to check before you enroll."],
  ["0:15", "One, your work permit has to stay valid for the whole program."],
  ["0:19", "Two, the program has to be six months or less."],
]

function Window({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`absolute top-5 left-5 border border-stone-200 bg-white text-[12.5px] shadow-[0_8px_24px_rgba(12,10,9,0.07)] ${className}`}>
      {children}
    </div>
  )
}

function WindowHeader({ children }: { children: ReactNode }) {
  return <div className="flex h-12 items-center gap-2 border-b border-stone-200 px-3.5">{children}</div>
}

const FACE_GUIDES = [
  "top-[22px] left-[22px] border-t-2 border-l-2 rounded-tl-[4px]",
  "top-[22px] right-[22px] border-t-2 border-r-2 rounded-tr-[4px]",
  "bottom-[34px] left-[22px] border-b-2 border-l-2 rounded-bl-[4px]",
  "bottom-[34px] right-[22px] border-b-2 border-r-2 rounded-br-[4px]",
]

function SetupScene() {
  return (
    <Window className="w-[calc(100%-40px)] max-w-[384px] rounded-[10px]">
      <WindowHeader>
        <span className="text-[13px] font-semibold">Studio setup</span>
        <span className="flex h-5 items-center rounded-md border border-stone-200 px-[7px] text-[11px] font-medium text-stone-600">1 of 3</span>
      </WindowHeader>
      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold">Your face</span>
          <span className="text-[12px] text-stone-500">One clear photo</span>
        </div>
        <div className="flex gap-3.5 rounded-[10px] border-[1.5px] border-dashed border-stone-400 bg-stone-50 p-2.5">
          <div className="relative h-[164px] w-[132px] shrink-0 overflow-hidden rounded-lg bg-stone-200">
            <Image src="/samples/alex-face.jpg" alt="" fill sizes="132px" className="object-cover" />
            {FACE_GUIDES.map((guide) => (
              <span key={guide} className={`absolute size-4 border-white ${guide}`} />
            ))}
            <span className="absolute bottom-2 left-2 flex h-5 items-center gap-1 rounded-full bg-white/95 px-[7px] text-[11px] font-medium">
              <Check className="size-2.5" strokeWidth={3} />
              Face found
            </span>
          </div>
          <div className="flex min-w-0 grow flex-col gap-2.5 pt-1">
            <span className="flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white">
              <Upload className="size-[15px]" strokeWidth={1.8} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium">Drop your photo here</span>
              <span className="text-[12px] text-stone-500">
                or <span className="text-stone-900 underline underline-offset-2">browse files</span>
              </span>
            </div>
            <div className="mt-auto flex flex-col gap-1.5 rounded-lg border border-stone-200 bg-white p-2">
              <div className="flex items-center justify-between gap-1.5 text-[12px]">
                <span className="truncate font-medium">my-photo.jpg</span>
                <span className="text-[11px] text-[#4d5a48]">Uploaded</span>
              </div>
              <span className="h-1 rounded-full bg-stone-900" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="flex h-8 grow items-center gap-1.5 rounded-md border border-stone-200 px-2.5 text-[12px] text-stone-600">
            <Mic className="size-[13px]" strokeWidth={1.8} />
            Next: your voice
          </span>
          <span className="flex h-8 grow items-center gap-1.5 rounded-md border border-stone-200 px-2.5 text-[12px] text-stone-600">
            <span className="size-3 rounded-[3px] bg-[#8c9a88]" />
            Then: branding
          </span>
        </div>
      </div>
    </Window>
  )
}

function ScriptScene() {
  return (
    <Window className="right-0 rounded-l-[10px] border-r-0">
      <WindowHeader>
        <span className="text-[13px] font-semibold">Two checks before you study on a work permit</span>
        <span className="flex h-5 items-center rounded-md border border-stone-200 px-[7px] text-[11px] font-medium text-stone-600">Draft</span>
      </WindowHeader>
      <div className="flex h-9 items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-3.5 text-[12px] text-stone-600">
        <Link2 className="size-3" strokeWidth={1.8} />
        Source: IRCC notice · September 9, 2026
      </div>
      <div className="grid grid-cols-[36px_1fr] gap-y-[7px] px-3.5 py-2.5 text-[13px] leading-[1.45]">
        {SCRIPT.map(([time, line], index) => (
          <div key={time} className="contents">
            <span className="pt-0.5 font-mono text-[11px] text-stone-400">{time}</span>
            <span>
              {index === 3 ? <span className="bg-[#eef0e9] shadow-[0_0_0_2px_#eef0e9]">{line}</span> : line}
            </span>
          </div>
        ))}
      </div>
    </Window>
  )
}

function VideoScene() {
  return (
    <Window className="right-0 flex rounded-l-[10px] border-r-0">
      <video
        controls
        muted
        playsInline
        preload="none"
        poster="/samples/work-permit-study-selfie-6mo.jpg"
        aria-label="Play an example finished work permit study video"
        className="m-2.5 h-[299px] w-[168px] shrink-0 rounded-lg bg-stone-900 object-cover"
      >
        <source src="/samples/work-permit-study-selfie.mp4" type="video/mp4" />
      </video>
      <div aria-hidden="true" className="flex grow flex-col gap-3 py-3.5 pr-3.5 pl-1">
        <span className="text-[13px] font-semibold">Ready to post</span>
        <div className="flex items-center gap-2">
          <span className="flex size-3.5 items-center justify-center rounded-[4px] bg-stone-900 text-stone-50">
            <Check className="size-2.5" strokeWidth={3.2} />
          </span>
          Script approved by you
        </div>
        <span className="h-px bg-stone-200" />
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-stone-500">Post to</span>
          <div className="flex gap-1.5">
            {PLATFORMS.map((platform) => (
              <span key={platform.name} title={platform.name} className="flex size-8 items-center justify-center rounded-md border border-stone-200">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-[14px]">
                  <path d={platform.path} />
                </svg>
              </span>
            ))}
          </div>
        </div>
        <span className="mt-auto flex h-[34px] items-center justify-center gap-1.5 rounded-md bg-stone-900 text-[12.5px] font-medium text-stone-50">
          <Download className="size-[13px]" strokeWidth={1.8} />
          Download MP4
        </span>
      </div>
    </Window>
  )
}

const STEPS = [
  {
    title: "Set up once.",
    body: "Add your face, voice and firm’s branding.",
    Scene: SetupScene,
    decorative: true,
  },
  {
    title: "We do the drafting.",
    body: "Get short scripts from the latest immigration news.",
    Scene: ScriptScene,
    decorative: true,
  },
  {
    title: "Review. Post. Repeat.",
    body: "Approve the script. Download your video. Share it.",
    Scene: VideoScene,
    decorative: false,
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-20 py-16 md:py-24 lg:py-28">
      <div className="mx-auto max-w-[1360px] px-(--page-pad)">
        <div className="mb-9 flex flex-col items-start gap-5 md:mb-10">
          <span className="flex h-[22px] items-center rounded-md border border-stone-200 bg-white px-2 text-[12px] font-medium text-stone-700">
            How it works
          </span>
          <h2 id="how-it-works-heading" className="font-serif text-[clamp(38px,4.5vw,60px)] leading-[1.04] font-light tracking-[-0.025em]">
            Set up once. <span className="text-stone-500">Show up often.</span>
          </h2>
          <p className="flex items-center gap-2 text-[12px] text-stone-500 md:hidden">
            Swipe through the steps <ArrowRight size={14} aria-hidden="true" />
          </p>
        </div>

        <ol tabIndex={0} aria-label="Three steps to your next video" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-400 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0 lg:gap-6">
          {STEPS.map(({ title, body, Scene, decorative }, index) => (
            <li key={title} className="flex w-[86%] min-w-0 shrink-0 snap-start flex-col gap-4 md:w-auto">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[13px] font-medium text-stone-50">
                  {index + 1}
                </span>
                <span className="h-px grow bg-stone-200" />
              </div>
              <div className="flex grow flex-col overflow-hidden rounded-[14px] border border-stone-200 bg-white shadow-xs">
                <div aria-hidden={decorative || undefined} className="relative h-[360px] overflow-hidden border-b border-stone-200 bg-stone-100">
                  <Scene />
                </div>
                <div className="flex flex-col gap-1.5 px-6 pt-5 pb-6">
                  <h3 className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h3>
                  <p className="text-[14px] leading-[1.55] text-stone-500">{body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-stone-200 pt-7 md:mt-12">
          <p className="text-[15px] text-stone-600">No weekly shoot. No blank page.</p>
          <a
            href="#waitlist"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-stone-900 px-[18px] text-[14px] font-medium text-stone-50 transition-colors hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-950 motion-reduce:transition-none"
          >
            Get my sample video
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

export { HowItWorks }
