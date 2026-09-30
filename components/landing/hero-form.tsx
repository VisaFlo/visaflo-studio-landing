"use client"

import { useWaitlist } from "@/components/landing/waitlist-provider"
import { Button } from "@/components/ui/button"

function HeroForm() {
  const { email, setEmail, submitted, pending, error, submit } = useWaitlist()

  if (submitted) {
    return (
      <div role="status" className="text-right text-[16px] text-stone-950">
        Request received. We&apos;ll contact {email} about your sample.
      </div>
    )
  }

  return (
    <div>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit("hero")
        }}
        className="flex flex-wrap justify-end gap-2"
      >
        <input
          type="email"
          name="email"
          autoComplete="email"
          aria-label="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@yourfirm.ca"
          className="h-[52px] max-w-[340px] flex-[1_1_240px] rounded-full border border-stone-950/16 bg-transparent px-5 text-[15px] text-stone-950 outline-none placeholder:text-stone-500 focus-visible:border-stone-950"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-[52px] rounded-full border-0 bg-stone-950 px-[26px] text-[15px] text-white hover:bg-stone-800"
        >
          {pending ? "Sending…" : "Get my sample video"}
        </Button>
      </form>
      <div
        role="alert"
        className="mt-2.5 min-h-[18px] text-right text-[13px] text-red-700"
      >
        {error}
      </div>
    </div>
  )
}

export { HeroForm }
