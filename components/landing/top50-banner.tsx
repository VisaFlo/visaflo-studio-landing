"use client";

import * as React from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EMAIL_PATTERN, INVALID_EMAIL_MESSAGE } from "@/lib/waitlist";

const SERVER_ERROR_MESSAGE = "Something went wrong. Please try again.";

// Announcement bar above the nav. The whole bar opens a dialog that asks for
// an email; the chart is sent there, so the ranking doubles as a lead magnet.
// "/chart" renders it with the dialog already open.
function Top50Banner({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

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
        body: JSON.stringify({ email: trimmed }),
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
    } catch {
      setError(SERVER_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError("");
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-stone-950 px-(--page-pad) py-3 text-center text-[14px] text-white hover:bg-stone-900"
        >
          <span className="text-stone-300">
            Top 50 RCICs &amp; immigration lawyers on YouTube, ranked.
          </span>
          <span className="bg-white px-2.5 py-1 text-[13px] font-medium text-stone-950">
            Click to get the chart
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        // Closing must not hand focus back to the banner and outline it.
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="gap-0 rounded-[8px] bg-white p-8 text-stone-950 sm:max-w-[440px]"
      >
        {sent ? (
          <>
            <DialogHeader className="gap-3">
              <DialogTitle className="font-serif text-[28px] leading-[1.15] font-normal tracking-[-0.01em]">
                Check your inbox
              </DialogTitle>
              <DialogDescription
                role="status"
                className="text-[15px] leading-[1.55] text-stone-600"
              >
                The charts have been sent to{" "}
                <span className="font-medium text-stone-950">{email}</span>.
                Please check your inbox or spam folder.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-7">
              <DialogClose asChild>
                <button
                  type="button"
                  className="flex h-[52px] w-full items-center justify-center rounded-none bg-stone-950 px-7 text-[16px] font-light text-white hover:bg-stone-800"
                >
                  Done
                </button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="gap-3">
              <DialogTitle className="font-serif text-[28px] leading-[1.15] font-normal tracking-[-0.01em]">
                Top 50 RCICs &amp; Immigration Lawyers on YouTube
              </DialogTitle>
              <DialogDescription className="text-[15px] leading-[1.55] text-stone-600">
                Licensed professionals only, ranked by subscribers and by views.
                Tell us where to send the charts.
              </DialogDescription>
            </DialogHeader>
            <form
              noValidate
              onSubmit={submit}
              className="mt-7 flex flex-col gap-3"
            >
              <input
                id="top50-email"
                type="email"
                autoComplete="email"
                autoFocus
                aria-label="Email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="your@email.com"
                aria-invalid={error ? true : undefined}
                className="h-[52px] rounded-[4px] border border-stone-300 bg-white px-4 text-[16px] text-stone-900 outline-none placeholder:text-stone-500 focus-visible:border-stone-900 aria-invalid:border-red-700"
              />
              <div
                role="alert"
                className="min-h-[18px] text-[13px] text-red-700"
              >
                {error}
              </div>
              <DialogFooter className="mt-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex h-[52px] w-full items-center justify-center rounded-none bg-stone-950 px-7 text-[16px] font-light text-white hover:bg-stone-800 disabled:opacity-60"
                >
                  {pending ? "Submitting…" : "Submit"}
                </button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { Top50Banner };
