import { WaitlistForm } from "@/components/landing/waitlist-form"

function WaitlistSection() {
  return (
    <section
      id="waitlist"
      className="scroll-mt-20 bg-[#f5f3ef] py-12 md:py-16 lg:py-20 text-stone-900"
    >
      <div className="mx-auto grid max-w-[1360px] px-(--page-pad) grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-16">
        <div>
          <div className="mb-5 font-mono text-[12px] tracking-[0.12em] text-stone-600 uppercase">
            Join the waitlist
          </div>
          <h2 className="font-serif text-[clamp(40px,5.4vw,76px)] leading-none font-light tracking-[-0.02em] text-balance">
            Be the first to try VisaFlo Studio.
          </h2>
          <p className="mt-7 max-w-[460px] text-[17px] leading-[1.55] text-stone-600">
            We&apos;re opening Studio to a small group first. Save your spot
            and we&apos;ll switch it on in your VisaFlo account as soon as
            it&apos;s your turn.
          </p>
        </div>
        <WaitlistForm />
      </div>
    </section>
  )
}

export { WaitlistSection }
