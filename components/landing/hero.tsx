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
        <span className="block">ready to upload,</span>
        <span className="block">in your own face and voice.</span>
      </h1>
      <p className="mt-5 max-w-[560px] text-[clamp(16px,1.3vw,18px)] leading-[1.5] text-pretty text-stone-600">
        No ring light. No scripts to write. VisaFlo Studio turns immigration
        news into videos with your face, voice and firm&apos;s branding.
        Review, then post.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <a
          href="#waitlist"
          className="flex min-h-11 items-center justify-center rounded-full bg-stone-950 px-5 text-[14px] font-medium text-white hover:bg-stone-800"
        >
          Get my sample video
        </a>
        <a href="#samples" className="text-[14px] text-stone-600 underline underline-offset-4 hover:text-stone-950">
          See examples
        </a>
      </div>
    </header>
  )
}

export { Hero }
