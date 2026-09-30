import { ArrowDown, ArrowUpRight } from "lucide-react"
import { PlatformRail } from "@/components/landing/platform-rail"

function Hero() {
  return (
    <header
      id="top"
      className="mx-auto max-w-[1360px] px-(--page-pad) pt-10 md:pt-16 lg:pt-20"
    >
      <div className="mb-7 font-mono text-[11px] tracking-[0.1em] uppercase">
        <span className="inline-block bg-stone-950 px-1.5 py-0.5 font-bold text-white">
          For busy immigration lawyers &amp; RCICs
        </span>
      </div>
      <h1 className="max-w-[1200px] font-serif text-[clamp(24px,7.5vw,72px)] leading-[1.02] font-light tracking-[-0.025em]">
        <span className="block">Fresh immigration news</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5">
          <span>ready to upload,</span>
          <PlatformRail />
        </span>
        <span className="block">in your own face and voice.</span>
      </h1>
      <p className="mt-5 max-w-[560px] text-[clamp(16px,1.3vw,18px)] leading-[1.5] text-pretty text-stone-600">
        No ring light. No scripts to write. We turn Regulatory Monitor updates
        and ATIP insights into your next branded video.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-6">
        <a
          href="#waitlist"
          className="group flex min-h-11 items-center justify-center gap-3 bg-stone-950 px-5 text-[14px] font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-950"
        >
          Get my sample video
          <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </a>
        <a href="#samples" className="flex min-h-11 items-center gap-2 text-[14px] text-stone-600 underline underline-offset-4 hover:text-stone-950">
          See examples
          <ArrowDown size={14} aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}

export { Hero }
