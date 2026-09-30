"use client"

import { useWaitlist } from "@/components/landing/waitlist-provider"
import { Button } from "@/components/ui/button"

const LABEL_CLASS = "flex flex-col gap-2 text-[13px] text-stone-600"
const INPUT_CLASS =
  "h-[52px] rounded-[4px] border border-stone-300 bg-white px-4 text-[16px] text-stone-900 outline-none placeholder:text-stone-500 focus-visible:border-stone-900"

function WaitlistForm() {
  const {
    email,
    name,
    firm,
    submitted,
    pending,
    error,
    setEmail,
    setName,
    setFirm,
    submit,
  } = useWaitlist()

  if (submitted) {
    return (
      <div role="status" className="border-t border-stone-900 pt-7">
        <div className="font-serif text-[36px] leading-[1.1]">
          Request received.
        </div>
        <p className="mt-3.5 text-[16px] leading-[1.55] text-stone-600">
          We&apos;ll contact {email} about your sample.
        </p>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit("waitlist")
      }}
      className="flex flex-col gap-5"
    >
      <label className={LABEL_CLASS}>
        Firm name
        <input
          name="firm"
          autoComplete="organization"
          value={firm}
          onChange={(event) => setFirm(event.target.value)}
          placeholder="Park Immigration Services"
          className={INPUT_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        Your name
        <input
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Jane Park"
          className={INPUT_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@yourfirm.ca"
          className={INPUT_CLASS}
        />
      </label>
      <Button
        type="submit"
        disabled={pending}
        className="mt-2 h-14 rounded-none border-0 text-[16px] hover:bg-stone-800"
      >
        {pending ? "Sending…" : "Get my sample video"}
      </Button>
      <div role="alert" className="min-h-[18px] text-[13px] text-red-700">
        {error}
      </div>
    </form>
  )
}

export { WaitlistForm }
