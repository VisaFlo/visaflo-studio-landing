function Hero() {
  return (
    <header
      id="top"
      className="mx-auto max-w-[1360px] px-(--page-pad) pt-12 md:pt-16 lg:pt-20"
    >
      <div className="mb-8 flex items-center gap-3 font-mono text-[12px] tracking-[0.12em] text-stone-600 uppercase">
        <span className="bg-stone-950 px-1.5 py-0.5 text-white">Coming soon</span>
        VisaFlo Studio
      </div>
      <h1 className="max-w-[1100px] font-serif text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[0.98] font-light tracking-[-0.025em] text-balance">
        Fresh immigration content every week, in your own face and voice.
      </h1>
      <p className="mt-12 max-w-[520px] text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-pretty text-stone-600">
        No topic hunting, no scripts, no ring light.{" "}
        <a
          href="https://visaflo.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="text-stone-950 underline underline-offset-4 hover:text-stone-700"
        >
          VisaFlo
        </a>
        {" "}
        turns the latest IRCC updates into videos of you, ready for YouTube,
        Instagram and LinkedIn.
      </p>
    </header>
  )
}

export { Hero }
