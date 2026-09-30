import { ArrowUpRight, FileText, Radio } from "lucide-react"

function MonitorVisual() {
  return (
    <div className="source-art source-art-monitor" aria-hidden="true">
      <div className="source-orbit source-orbit-one" />
      <div className="source-orbit source-orbit-two" />
      <div className="source-feed">
        {["Immigration news", "Policy changes", "Program updates"].map((title) => (
          <div key={title} className="source-feed-row">
            <span className="size-1.5 bg-[#899281]" />
            <span className="font-serif text-[21px] tracking-[-0.02em]">{title}</span>
          </div>
        ))}
      </div>
      <span className="source-mark"><Radio size={20} strokeWidth={1.4} /></span>
    </div>
  )
}

function AtipVisual() {
  return (
    <div className="source-art source-art-atip" aria-hidden="true">
      <div className="source-record source-record-back" />
      <div className="source-record source-record-front">
        <div className="mb-5 flex items-center justify-between border-b border-stone-300 pb-3">
          <span className="font-mono text-[10px] tracking-[0.08em] text-stone-500">RELEASED RECORDS</span>
          <FileText size={16} strokeWidth={1.2} className="text-stone-500" />
        </div>
        <div className="record-lines">
          <span /><span /><span /><span />
        </div>
        <div className="source-record-note">
          <span className="font-mono text-[9px] tracking-[0.1em] uppercase">The context behind the story</span>
          <span className="mt-1 block font-serif text-[29px] leading-none tracking-[-0.03em]">More to say.</span>
        </div>
      </div>
    </div>
  )
}

function InsightsVisual() {
  return (
    <div className="source-art source-art-insights" aria-hidden="true">
      <div className="source-idea">
        <span className="font-mono text-[9px] tracking-[0.1em] text-stone-500 uppercase">Your take</span>
        <p className="mt-3 font-serif text-[27px] leading-[1.1] tracking-[-0.02em]">What clients<br />keep asking.</p>
      </div>
      <div className="source-idea-draft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-mono text-[9px] tracking-[0.08em] text-stone-500 uppercase">Your video script</span>
          <FileText size={14} strokeWidth={1.2} className="text-stone-500" />
        </div>
        <div className="record-lines"><span /><span /><span /></div>
      </div>
    </div>
  )
}

const SOURCES = [
  {
    title: "Regulatory Monitor",
    body: "Turn immigration news and policy changes into your next talking point.",
    Visual: MonitorVisual,
  },
  {
    title: "ATIP insights",
    body: "Give your audience a closer look at released immigration records.",
    Visual: AtipVisual,
  },
  {
    title: "Your insights",
    body: "Bring your take on any immigration topic. We turn it into a video script.",
    Visual: InsightsVisual,
  },
]

function SourceToVideo() {
  return (
    <section id="the-difference" aria-labelledby="sources-heading" className="bg-[#f5f3ef] py-14 md:py-20">
      <div className="mx-auto max-w-[1360px] px-(--page-pad)">
        <div className="mb-10 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end md:gap-12">
          <div>
            <p className="mb-5 font-mono text-[11px] tracking-[0.1em] text-stone-500 uppercase">Where your content starts</p>
            <h2 id="sources-heading" className="font-serif text-[clamp(40px,4.7vw,64px)] leading-[1.02] font-light tracking-[-0.025em]">
              Our research.<br />Your ideas.
            </h2>
          </div>
          <p className="max-w-[320px] text-[16px] leading-[1.6] text-stone-600">
            Choose a source or share your take. We draft the script.
          </p>
        </div>

        <ol aria-label="Three starting points for your content" className="grid gap-9 lg:grid-cols-3 lg:gap-7">
          {SOURCES.map(({ title, body, Visual }, index) => (
            <li key={title} className="source-feature group min-w-0">
              <Visual />
              <div className="flex items-start gap-3 border-t border-stone-950/20 pt-5">
                <span aria-hidden="true" className="shrink-0 font-serif text-[37px] leading-none tracking-[-0.04em] text-stone-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="pt-1">
                  <h3 className="font-serif text-[clamp(24px,2.1vw,28px)] leading-[1.1] tracking-[-0.02em]">{title}</h3>
                  <p className="mt-2 max-w-[400px] text-[15px] leading-[1.6] text-stone-600">{body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <a href="#waitlist" className="group mt-10 inline-flex min-h-11 items-center gap-5 border-b border-stone-950 text-[14px] font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-950">
          Get my sample video
          <ArrowUpRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
        </a>
      </div>
    </section>
  )
}

export { SourceToVideo }
