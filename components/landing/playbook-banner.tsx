"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowRight, Check, FileText, Mail, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { trackStudioEvent } from "@/lib/analytics"
import { getAttribution } from "@/lib/attribution"
import { identify } from "@/lib/mixpanel"
import { PLAYBOOK_EDITION, PLAYBOOK_FILES } from "@/lib/playbook"
import { cn } from "@/lib/utils"
import { EMAIL_PATTERN, INVALID_EMAIL_MESSAGE } from "@/lib/waitlist"

export function PlaybookBanner({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [email, setEmail] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState("")
  const defaultTracked = React.useRef(false)
  React.useEffect(() => {
    if (defaultOpen && !defaultTracked.current) {
      defaultTracked.current = true
      trackStudioEvent("playbook_dialog_open", { auto: true })
    }
  }, [defaultOpen])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    const trimmed = email.trim()
    if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) {
      setError(INVALID_EMAIL_MESSAGE)
      return
    }
    setError("")
    setPending(true)
    try {
      const response = await fetch("/api/playbook", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, attribution: getAttribution() }),
      })
      if (!response.ok) {
        setError(response.status === 400 ? INVALID_EMAIL_MESSAGE : "We couldn't send the playbook. Please try again.")
        return
      }
      setEmail(trimmed)
      setSent(true)
      identify(trimmed)
      trackStudioEvent("generate_lead", { lead_type: "video_playbook" })
    } catch {
      setError("We couldn't send the playbook. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next)
      if (next && !open) trackStudioEvent("playbook_dialog_open", { auto: false })
      if (!next) setError("")
    }}>
      <DialogTrigger asChild>
        <button type="button" className="flex min-h-11 w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-stone-200 bg-stone-100 px-(--page-pad) py-2.5 text-center text-[13px] text-stone-800 hover:bg-stone-200/70">
          <span className="rounded-md border border-stone-300 px-2 py-0.5 text-[11px] font-medium">Free guide</span>
          <span>Video Playbook: 9 formats for your next immigration video.</span>
          <span className="flex items-center gap-1.5 font-medium underline decoration-stone-400 underline-offset-4">Get the playbook<ArrowRight className="size-3.5" aria-hidden="true" /></span>
        </button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} onCloseAutoFocus={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}
        className={cn("max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[14px] border border-stone-200 bg-white p-0 text-stone-950 shadow-[0_24px_64px_rgba(12,10,9,0.28)] ring-0", sent ? "sm:max-w-[460px]" : "sm:max-w-[760px] sm:grid-cols-[300px_1fr]")}>
        <DialogClose asChild><button type="button" aria-label="Close" className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 sm:top-3.5 sm:right-3.5 sm:size-8"><X className="size-4" aria-hidden="true" /></button></DialogClose>
        {sent ? (
          <div className="flex flex-col p-6 sm:p-8">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#eef0e9] text-[#4d5a48]"><Mail className="size-[18px]" aria-hidden="true" /></span>
            <DialogHeader className="mt-[18px] gap-2.5">
              <DialogTitle className="font-serif text-[30px] leading-[1.12] font-normal">Check your inbox</DialogTitle>
              <DialogDescription role="status" className="text-[14.5px] leading-[1.55] text-stone-600">The playbook and research kit have been sent to <span className="font-medium break-all text-stone-950">{email}</span>. Please check your inbox or spam folder.</DialogDescription>
            </DialogHeader>
            <ul className="mt-5 overflow-hidden rounded-[10px] border border-stone-200">
              {PLAYBOOK_FILES.map((file) => <li key={file.file} className="flex items-center gap-2.5 border-b border-stone-200 px-3 py-3 last:border-b-0"><FileText className="size-4 shrink-0 text-stone-500" aria-hidden="true" /><span className="grow text-[13px]">{file.label}</span><span className="text-[11px] font-medium text-stone-500">{file.format}</span></li>)}
            </ul>
            <DialogClose asChild><button type="button" className="mt-6 flex h-11 items-center justify-center rounded-lg bg-stone-900 text-[14px] font-medium text-stone-50 hover:bg-stone-800">Done</button></DialogClose>
          </div>
        ) : (
          <>
            <div className="hidden items-center border-r border-stone-200 bg-stone-100 p-5 sm:flex"><Image src="/playbook-cover.png" alt="October 2026 Video Playbook cover: 50 channels, 7,558 videos, 9 video formats" width={1236} height={1600} className="h-auto w-full shadow-lg" sizes="260px" /></div>
            <div className="flex flex-col px-5 pt-6 pb-6 sm:px-8 sm:pt-8 sm:pb-7">
              <span className="self-start rounded-md border border-stone-200 px-2 py-1 text-[12px] font-medium text-stone-700">Free · {PLAYBOOK_EDITION}</span>
              <DialogHeader className="mt-4 gap-2.5">
                <DialogTitle className="pr-7 font-serif text-[30px] leading-[1.12] font-normal tracking-[-0.015em]">Your next immigration video starts here.</DialogTitle>
                <DialogDescription className="text-[14.5px] leading-[1.55] text-stone-600">Get 9 video formats, practical openings and filming blueprints. Tell us where to send your Video Playbook.</DialogDescription>
              </DialogHeader>
              <ul className="mt-5 flex flex-col gap-2.5 text-[13px] leading-[1.45] text-stone-700">
                {["50 channels and 7,558 recent uploads", "179 title and thumbnail examples reviewed", "16-page PDF + bonus research kit"].map((fact) => <li key={fact} className="flex gap-2"><Check className="mt-px size-[15px] shrink-0 text-[#4d5a48]" aria-hidden="true" />{fact}</li>)}
              </ul>
              <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-2">
                <label htmlFor="playbook-email" className="text-[13px] font-medium">Email</label>
                <input id="playbook-email" type="email" autoComplete="email" autoFocus maxLength={254} disabled={pending} value={email} onChange={(event) => { setEmail(event.target.value); setError("") }} placeholder="you@yourfirm.com" aria-invalid={error ? true : undefined} aria-describedby="playbook-error" className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-[16px] outline-none placeholder:text-stone-400 focus-visible:border-stone-500 focus-visible:ring-3 focus-visible:ring-stone-400/25 aria-invalid:border-red-700 sm:h-11 sm:text-[15px]" />
                <div id="playbook-error" role="alert" className="min-h-[18px] text-[13px] text-red-700">{error}</div>
                <button type="submit" disabled={pending} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-stone-900 text-[15px] font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-60 sm:h-11 sm:text-[14px]">{pending ? "Sending…" : "Send me the playbook"}{!pending && <ArrowRight className="size-[15px]" aria-hidden="true" />}</button>
                <p className="mt-1 text-center text-[12px] text-stone-500">The PDF and research kit, straight to your inbox.</p>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
