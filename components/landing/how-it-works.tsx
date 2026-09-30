const STEPS = [
  {
    title: "Set up your likeness",
    body: "Create your face and voice model once. It's tied to your account and can be deleted at any time.",
  },
  {
    title: "We draft from IRCC",
    body: "When IRCC announces an update, VisaFlo drafts a script from the official source and links it on screen.",
  },
  {
    title: "You approve every word",
    body: "Edit any line before it renders. Nothing is published without your sign-off.",
  },
  {
    title: "Post everywhere",
    body: "Export 9:16, 1:1 and 16:9 with burned-in captions and your firm's branding.",
  },
]

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-[1360px] px-(--page-pad)">
        <div className="mb-12 font-mono text-[12px] tracking-[0.12em] text-stone-600 uppercase">
          How it works
        </div>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-10 gap-y-12">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <div className="mb-4 font-mono text-[13px] text-stone-400">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h2 className="mb-3 font-serif text-[24px]">{step.title}</h2>
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
