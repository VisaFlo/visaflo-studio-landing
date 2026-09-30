const STEPS = [
  {
    title: "Set up once",
    body: "Add your face, voice and branding.",
  },
  {
    title: "We draft",
    body: "Short scripts from the latest immigration news.",
  },
  {
    title: "Review & post",
    body: "Approve the script, then download and post your branded video.",
  },
]

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-[1360px] px-(--page-pad)">
        <div className="mb-12">
          <div className="mb-5 font-mono text-[12px] tracking-[0.12em] text-stone-600 uppercase">
            How it works
          </div>
          <h2 className="max-w-[800px] font-serif text-[clamp(36px,4.2vw,58px)] leading-[1.05] font-light tracking-[-0.02em] text-balance">
            Set up. Review. Post.
          </h2>
        </div>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-10 gap-y-12">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <div className="mb-4 font-mono text-[13px] text-stone-400">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mb-3 font-serif text-[24px]">{step.title}</h3>
              <p className="text-[15px] leading-[1.6] text-stone-600">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export { HowItWorks }
