"use client";

import * as React from "react";
import { ArrowRight, ArrowUpRight, Check, ImageIcon, Lock, Mail, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trackStudioEvent } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";
import { identify } from "@/lib/mixpanel";
import { CHART_DATA_DATE } from "@/lib/top50";
import { cn } from "@/lib/utils";
import { EMAIL_PATTERN, INVALID_EMAIL_MESSAGE } from "@/lib/waitlist";

const SERVER_ERROR_MESSAGE = "Something went wrong. Please try again.";

// Only the top five are shown here; the full ranking is sent by email.
const TOP_FIVE = [
  { rank: 1, name: "Ahmed Elzoghbi", who: "Immigration Zoghbi", licence: "RCIC", subs: "393K" },
  { rank: 2, name: "Immiland", who: "Eddy Ramirez · Immiland Law", licence: "Lawyer", subs: "290K" },
  { rank: 3, name: "Fernando Torres Canada", who: "Fernando Torres Immigration", licence: "RCIC", subs: "282K" },
  { rank: 4, name: "Anyvisa Immigration", who: "Anyvisa Services · 3 RCICs", licence: "RCIC", subs: "259K" },
  { rank: 5, name: "LMRT Immigration", who: "Loujin Khalil", licence: "RCIC", subs: "234K" },
];

const CHART_FACTS = [
  "Licence checked on the CICC register and law society directories",
  "Ranked by subscribers and by views in the last 12 months",
  `Public YouTube counts, measured ${CHART_DATA_DATE}`,
];

const CHART_FILES = [
  { label: "Ranked by subscribers", filename: "VisaFlo-Top-50-RCICs-on-YouTube-by-subscribers.png" },
  { label: "Ranked by views", filename: "VisaFlo-Top-50-RCICs-on-YouTube-by-views.png" },
];

function RankingPreview() {
  return (
    <div aria-hidden="true" className="relative border-b border-stone-200 bg-stone-50 sm:border-r sm:border-b-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex gap-0.5 rounded-lg bg-[#efedea] p-[3px]">
          <span className="flex h-[26px] items-center rounded-md bg-white px-2.5 text-[12px] font-medium shadow-xs">By subscribers</span>
          <span className="flex h-[26px] items-center px-2.5 text-[12px] font-medium text-stone-500">By views</span>
        </div>
        <span className="mr-10 text-[11px] text-stone-500 sm:mr-0">Sep 28, 2026</span>
      </div>
      <div className="grid grid-cols-[24px_1fr_52px] gap-x-2.5 border-b border-stone-200 px-4 pb-2 text-[11px] font-medium text-stone-500">
        <span>#</span>
        <span>Channel</span>
        <span className="text-right">Subs</span>
      </div>
      {TOP_FIVE.map((row) => (
        <div key={row.rank} className="grid grid-cols-[24px_1fr_52px] items-center gap-x-2.5 border-b border-[#efedea] px-4 py-2 sm:py-[9px]">
          <span
            className={cn(
              "flex size-[22px] items-center justify-center rounded-[5px] text-[11px] font-semibold",
              row.rank <= 3 ? "bg-stone-900 text-stone-50" : "bg-white text-stone-700 ring-1 ring-stone-200 ring-inset",
            )}
          >
            {row.rank}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold">{row.name}</span>
              <span className="hidden h-4 shrink-0 items-center rounded-[4px] border border-stone-200 bg-white px-[5px] text-[9.5px] font-medium tracking-[0.04em] text-stone-600 uppercase sm:flex">
                {row.licence}
              </span>
            </span>
            <span className="hidden truncate text-[11.5px] text-stone-500 sm:block">{row.who}</span>
          </span>
          <span className="text-right text-[13px] font-semibold tabular-nums">{row.subs}</span>
        </div>
      ))}
      <div className="flex flex-col items-center gap-2 px-4 py-4 sm:py-6">
        <span className="flex h-7 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-700 shadow-xs">
          <Lock className="size-3" strokeWidth={2} />
          Ranks 6–50 in the full chart
        </span>
      </div>
    </div>
  );
}

// Announcement bar above the nav. The whole bar opens a dialog that asks for
// an email; the chart is sent there, so the ranking doubles as a lead magnet.
// "/chart" renders it with the dialog already open.
function Top50Banner({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

  // "/chart" opens the dialog without a click, so count that open here.
  React.useEffect(() => {
    if (defaultOpen) trackStudioEvent("top50_dialog_open", { auto: true });
  }, [defaultOpen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(INVALID_EMAIL_MESSAGE);
      return;
    }
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/top50", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, attribution: getAttribution() }),
      });
      if (response.status === 400) {
        setError(INVALID_EMAIL_MESSAGE);
        return;
      }
      if (!response.ok) {
        setError(SERVER_ERROR_MESSAGE);
        return;
      }
      setEmail(trimmed);
      setSent(true);
      identify(trimmed);
      trackStudioEvent("generate_lead", { lead_type: "top50_chart" });
    } catch {
      setError(SERVER_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  };

  const openSampleForm = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // The dialog locks page scrolling, so close it first and then scroll.
    event.preventDefault();
    setOpen(false);
    window.setTimeout(() => {
      document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) trackStudioEvent("top50_dialog_open", { auto: false });
        if (!next) setError("");
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-h-12 w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-stone-950 px-(--page-pad) py-2.5 text-center text-[14px] text-stone-50 hover:bg-stone-900"
        >
          <span className="flex h-[22px] items-center rounded-md border border-stone-50/25 px-2 text-[12px] font-medium">
            New
          </span>
          <span className="text-stone-300">
            Top 50 RCICs &amp; immigration lawyers on YouTube, ranked.
          </span>
          <span className="flex items-center gap-1.5 font-medium underline decoration-stone-50/40 underline-offset-4">
            Get the chart
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        // Closing must not hand focus back to the banner and outline it.
        onCloseAutoFocus={(event) => event.preventDefault()}
        // Only the Close button (or Esc) dismisses it, not a click on the backdrop.
        onInteractOutside={(event) => event.preventDefault()}
        className={cn(
          "max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[14px] border border-stone-200 bg-white p-0 text-stone-950 shadow-[0_24px_64px_rgba(12,10,9,0.28)] ring-0",
          sent ? "sm:max-w-[460px]" : "sm:max-w-[820px] sm:grid-cols-[380px_1fr]",
        )}
      >
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-950 sm:top-3.5 sm:right-3.5 sm:size-8"
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </DialogClose>
        {sent ? (
          <div className="flex flex-col p-6 sm:p-8">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#eef0e9] text-[#4d5a48]">
              <Mail className="size-[18px]" strokeWidth={2} aria-hidden="true" />
            </span>
            <DialogHeader className="mt-[18px] gap-2.5">
              <DialogTitle className="font-serif text-[28px] leading-[1.12] font-normal tracking-[-0.015em] sm:text-[30px]">
                Check your inbox
              </DialogTitle>
              <DialogDescription
                role="status"
                className="text-[14.5px] leading-[1.55] text-stone-600"
              >
                The charts have been sent to{" "}
                <span className="font-medium break-all text-stone-950">{email}</span>.
                Please check your inbox or spam folder.
              </DialogDescription>
            </DialogHeader>
            <ul className="mt-5 overflow-hidden rounded-[10px] border border-stone-200">
              {CHART_FILES.map((chart) => (
                <li key={chart.filename} className="flex items-center gap-2.5 border-b border-stone-200 px-3 py-2.5 last:border-b-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-600">
                    <ImageIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 grow flex-col">
                    <span className="text-[13px] font-medium">{chart.label}</span>
                    <span className="truncate text-[11.5px] text-stone-500">{chart.filename}</span>
                  </span>
                  <span className="flex h-5 items-center rounded-[5px] border border-stone-200 px-1.5 text-[10.5px] font-medium text-stone-600">
                    PNG
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <button
                  type="button"
                  className="flex h-11 flex-1 items-center justify-center rounded-lg border border-stone-200 bg-white text-[14px] font-medium hover:bg-stone-50"
                >
                  Done
                </button>
              </DialogClose>
              <a
                href="#waitlist"
                onClick={openSampleForm}
                className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-stone-900 text-[14px] font-medium text-stone-50 hover:bg-stone-800"
              >
                Get my sample video
                <ArrowUpRight className="size-[15px]" aria-hidden="true" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <RankingPreview />
            <div className="flex flex-col px-5 pt-5 pb-6 sm:px-8 sm:pt-8 sm:pb-7">
              <span className="flex h-[22px] items-center self-start rounded-md border border-stone-200 px-2 text-[12px] font-medium text-stone-700">
                Free · 2 charts
              </span>
              <DialogHeader className="mt-3 gap-2.5 sm:mt-4">
                <DialogTitle className="pr-6 font-serif text-[25px] leading-[1.13] font-normal tracking-[-0.015em] sm:pr-0 sm:text-[30px]">
                  Top 50 RCICs &amp; Immigration Lawyers on YouTube
                </DialogTitle>
                <DialogDescription className="text-[14.5px] leading-[1.55] text-stone-600">
                  Licensed professionals only, ranked by subscribers and by views.
                  Tell us where to send the charts.
                </DialogDescription>
              </DialogHeader>
              <ul className="mt-5 hidden flex-col gap-2.5 text-[13px] leading-[1.45] text-stone-700 sm:flex">
                {CHART_FACTS.map((fact) => (
                  <li key={fact} className="flex gap-2">
                    <Check className="mt-px size-[15px] shrink-0 text-[#4d5a48]" strokeWidth={2.2} aria-hidden="true" />
                    {fact}
                  </li>
                ))}
              </ul>
              <form
                noValidate
                onSubmit={submit}
                className="mt-5 flex flex-col gap-2 sm:mt-7"
              >
                <label htmlFor="top50-email" className="text-[13px] font-medium">
                  Email
                </label>
                <input
                  id="top50-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="you@yourfirm.com"
                  aria-invalid={error ? true : undefined}
                  aria-describedby="top50-error"
                  className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-[16px] text-stone-900 outline-none placeholder:text-stone-400 focus-visible:border-stone-500 focus-visible:ring-3 focus-visible:ring-stone-400/25 aria-invalid:border-red-700 aria-invalid:ring-red-700/15 sm:h-11 sm:text-[15px]"
                />
                <div
                  id="top50-error"
                  role="alert"
                  className="min-h-[18px] text-[13px] text-red-700"
                >
                  {error}
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex h-12 items-center justify-center gap-2 rounded-lg bg-stone-900 text-[15px] font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-60 sm:h-11 sm:text-[14px]"
                >
                  {pending ? "Sending…" : "Send me the charts"}
                  {!pending && <ArrowRight className="size-[15px]" aria-hidden="true" />}
                </button>
                <p className="mt-1 text-center text-[12px] text-stone-500">
                  Two PNG charts, straight to your inbox.
                </p>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { Top50Banner };
