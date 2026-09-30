import type { ReactNode } from "react"
import { ArrowUpRight, Check, FileText } from "lucide-react"

// Each source card shows a window of the product, running off the card edge, with real content:
// headlines from the sample videos, and a thread from a released ATIP package.
function ProductWindow({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="relative h-[320px] overflow-hidden border-t border-stone-200 bg-stone-100">
      <div className="absolute top-6 right-0 left-6 rounded-l-[10px] border border-r-0 border-stone-200 bg-white text-[12.5px] shadow-[0_8px_24px_rgba(12,10,9,0.07)]">
        {children}
      </div>
    </div>
  )
}

function WindowHeader({ children }: { children: ReactNode }) {
  return <div className="flex h-12 items-center gap-2 border-b border-stone-200 px-3.5">{children}</div>
}

function Checkbox({ checked = false }: { checked?: boolean }) {
  return checked ? (
    <span className="flex size-3.5 items-center justify-center rounded-[4px] bg-stone-900 text-stone-50">
      <Check className="size-2.5" strokeWidth={3.2} />
    </span>
  ) : (
    <span className="size-3.5 rounded-[4px] border border-stone-300" />
  )
}

const MONITOR_ROWS = [
  { topic: "Work permit", title: "Study up to 6 months without a study permit", meta: "IRCC notice · September 9, 2026", selected: true },
  { topic: "Express Entry", title: "CEC draw: 2,000 invitations, CRS 518", meta: "Rounds of invitations" },
  { topic: "Study permit", title: "Proof of funds rises to $23,448", meta: "Program update" },
  { topic: "Sponsorship", title: "Parents and grandparents: intake paused, super visa stays open", meta: "Policy change" },
]

function MonitorWindow() {
  return (
    <ProductWindow>
      <WindowHeader>
        <span className="text-[13px] font-semibold">Regulatory Monitor</span>
        <span className="flex h-[18px] items-center rounded-full bg-stone-100 px-1.5 text-[11px] font-medium text-stone-600">4 new</span>
        <span className="ml-auto flex h-7 items-center rounded-md bg-stone-900 px-2.5 text-[12px] font-medium text-stone-50">Draft script</span>
      </WindowHeader>
      <div className="grid h-[34px] grid-cols-[16px_104px_1fr] items-center gap-x-3 border-b border-stone-200 px-3.5 text-[12px] font-medium text-stone-500">
        <Checkbox />
        <span>Topic</span>
        <span>Update</span>
      </div>
      {MONITOR_ROWS.map((row) => (
        <div
          key={row.title}
          className={`grid min-h-[52px] grid-cols-[16px_104px_1fr] items-center gap-x-3 border-b border-stone-200 px-3.5 last:border-b-0 ${row.selected ? "bg-stone-50" : ""}`}
        >
          <Checkbox checked={row.selected} />
          <span className="flex h-5 items-center justify-self-start rounded-md border border-stone-200 bg-white px-[7px] text-[11px] font-medium whitespace-nowrap">
            {row.topic}
          </span>
          <div className="flex flex-col gap-0.5 py-2">
            <span className="font-medium">{row.title}</span>
            <span className="text-[11.5px] text-stone-500">{row.meta}</span>
          </div>
        </div>
      ))}
    </ProductWindow>
  )
}

function AtipWindow() {
  return (
    <ProductWindow>
      <WindowHeader>
        <FileText className="size-[15px] text-stone-600" strokeWidth={1.7} />
        <span className="text-[13px] font-semibold">A-2025-72666.pdf</span>
        <span className="text-[12px] text-stone-500">2,617 pages</span>
        <span className="ml-auto flex h-5 items-center rounded-md bg-stone-100 px-[7px] text-[11px] font-medium text-stone-600">Released records</span>
      </WindowHeader>
      <div className="flex flex-col gap-2.5 px-[18px] py-4 font-mono text-[11.5px] leading-[1.6] text-stone-800">
        <div className="flex flex-col">
          <span><span className="text-stone-500">Subject:</span> Question regarding Somalian passport</span>
          <span><span className="text-stone-500">Date:</span> 2025-07-18</span>
          <span><span className="text-stone-500">To:</span> IMM Reps</span>
        </div>
        <span>
          May name is <span className="inline-block h-[11px] w-24 bg-stone-950 align-[-1px]" />{" "}
          <span className="text-[10px] text-stone-500">s.19(1)</span>
        </span>
        <span>
          May you please advise how a citizen from Somalia holding a Somalian passport can apply for any kind of
          immigration pathway in Canada, such as a study permit, TRV, PR, etc.
        </span>
        <span className="h-px bg-stone-200" />
        <span>
          <span className="bg-[#eef0e9] shadow-[0_0_0_2px_#eef0e9]">
            Unless otherwise specified on the IRCC special measures page, the application process is the same for all
            nationalities.
          </span>
        </span>
        <span className="text-stone-500">The Immigration Representatives Mailbox</span>
      </div>
    </ProductWindow>
  )
}

function InsightsWindow() {
  return (
    <ProductWindow>
      <WindowHeader>
        <span className="text-[13px] font-semibold">New script</span>
        <span className="flex h-5 items-center rounded-md border border-stone-200 px-[7px] text-[11px] font-medium text-stone-600">From your notes</span>
      </WindowHeader>
      <div className="flex flex-col gap-2 p-3.5">
        <span className="text-[12px] font-medium text-stone-700">Your take</span>
        <div className="min-h-[88px] rounded-lg border border-stone-400 px-3 py-2.5 text-[13px] leading-[1.55] shadow-[0_0_0_3px_rgba(168,162,158,0.22)]">
          Clients keep asking if they can take a short course on their work permit. Most don’t check that the permit
          stays valid for the whole program.
          <span className="ml-0.5 inline-block h-3.5 w-px bg-stone-950 align-[-2px]" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-[26px] whitespace-nowrap items-center rounded-md border border-stone-200 px-2 text-[12px] text-stone-700">Topic: Work permit</span>
          <span className="hidden h-[26px] whitespace-nowrap sm:flex items-center rounded-md border border-stone-200 px-2 text-[12px] text-stone-700">Length: 25 sec</span>
          <span className="ml-auto flex whitespace-nowrap h-[30px] items-center rounded-md bg-stone-900 px-3 text-[12px] font-medium text-stone-50">Draft script</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-stone-200 bg-stone-50 px-3.5 py-3">
        <span className="text-[11px] font-medium text-stone-500">Draft · 0:25</span>
        <span className="text-[13px] font-medium">“Thinking about a course while you’re on a work permit? Check this first.”</span>
      </div>
    </ProductWindow>
  )
}

const SOURCES = [
  {
    title: "Regulatory Monitor",
    body: "Turn immigration news and policy changes into your next talking point.",
    Window: MonitorWindow,
  },
  {
    title: "ATIP insights",
    body: "Give your audience a closer look at released immigration records.",
    Window: AtipWindow,
  },
  {
    title: "Your insights",
    body: "Bring your take on any immigration topic. We turn it into a video script.",
    Window: InsightsWindow,
  },
]

function SourceToVideo() {
  return (
    <section id="the-difference" aria-labelledby="sources-heading" className="bg-stone-50 py-16 md:py-24">
      <div className="mx-auto max-w-[1360px] px-(--page-pad)">
        <div className="mb-10 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end md:gap-12">
          <div className="flex flex-col items-start gap-5">
            <span className="flex h-[22px] items-center rounded-md border border-stone-200 bg-white px-2 text-[12px] font-medium text-stone-700">
              Where your content starts
            </span>
            <h2 id="sources-heading" className="font-serif text-[clamp(40px,4.7vw,60px)] leading-[1.02] font-light tracking-[-0.025em]">
              Our research.<br />Your ideas.
            </h2>
          </div>
          <p className="max-w-[320px] text-[16px] leading-[1.6] text-stone-600">
            Choose a source or share your take. We draft the script.
          </p>
        </div>

        <ol aria-label="Three starting points for your content" className="grid gap-6 lg:grid-cols-3">
          {SOURCES.map(({ title, body, Window }) => (
            <li key={title} className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-stone-200 bg-white shadow-xs">
              <div className="flex flex-col gap-1.5 p-6">
                <h3 className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="text-[14px] leading-[1.55] text-stone-500">{body}</p>
              </div>
              <Window />
            </li>
          ))}
        </ol>

        <a
          href="#waitlist"
          className="group mt-10 inline-flex h-11 items-center gap-2 rounded-lg bg-stone-900 px-[18px] text-[14px] font-medium text-stone-50 transition-colors hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-950 motion-reduce:transition-none"
        >
          Get my sample video
          <ArrowUpRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
        </a>
      </div>
    </section>
  )
}

export { SourceToVideo }
