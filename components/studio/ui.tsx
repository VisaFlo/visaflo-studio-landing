"use client"

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Logo } from "@/components/landing/logo"
import { cn } from "@/lib/utils"

export function Page({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-white font-sans text-stone-950">{children}</div>
}

export function AccountHeader({
  name,
  email,
  initials,
  onSignOut,
}: {
  name?: string
  email?: string
  initials?: string
  onSignOut?: () => void
}) {
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", close)
    }
  }, [open])

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-stone-950/8 px-(--page-pad)">
      <Link href="/" aria-label="VisaFlo Studio home" className="flex">
        <Logo />
      </Link>
      {email && (
        <div ref={menu} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 items-center gap-3 text-[14px] text-stone-700 hover:text-stone-950"
          >
            <span className="hidden max-w-[200px] truncate sm:block">{name || email}</span>
            <span className="flex size-8 items-center justify-center bg-stone-100 font-medium text-stone-950">
              {initials}
            </span>
          </button>
          {open && (
            <div
              role="menu"
              className="absolute top-full right-0 z-30 mt-2 flex w-64 flex-col border border-stone-200 bg-white py-2 shadow-[0_8px_24px_rgba(12,10,9,0.08)]"
            >
              <span className="truncate px-4 py-2 text-[14px] text-stone-600">{email}</span>
              <a role="menuitem" href="https://my.vflo.app" className="px-4 py-2.5 text-[14px] hover:bg-stone-50">
                Open VisaFlo
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={onSignOut}
                className="px-4 py-2.5 text-left text-[14px] hover:bg-stone-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

export function FlowHeader({ title, step, onBack }: { title: string; step?: string; onBack?: () => void }) {
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-stone-950/8 px-(--page-pad)">
      {onBack && (
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="-ml-3 flex size-11 items-center justify-center hover:bg-stone-50"
        >
          <ChevronLeft className="size-5" strokeWidth={1.8} />
        </button>
      )}
      <span className="text-[16px] font-medium">{title}</span>
      {step && <span className="ml-auto font-mono text-[12px] tracking-[0.1em] text-stone-600 uppercase">{step}</span>}
    </header>
  )
}

export type HeaderStep = {
  label: string
  state: "done" | "current" | "todo"
  /** Set when the step can be opened again to change it. */
  onOpen?: () => void
}

// /start's header: back, the logo, the five steps (any step already reached
// can be opened again), and where you are. Labels give way on narrow screens,
// the current one last.
export function StepsHeader({ steps, counter, onBack }: { steps: HeaderStep[]; counter: string; onBack?: () => void }) {
  return (
    <header className="grid h-[72px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-stone-950/8 px-3 sm:px-(--page-pad)">
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="flex size-11 shrink-0 items-center justify-center hover:bg-stone-50 sm:-ml-3"
          >
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </button>
        )}
        <Link href="/" aria-label="VisaFlo Studio home" className="hidden sm:flex">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Your sample video">
        <ol className="m-0 flex list-none items-center gap-2 p-0 sm:gap-2.5">
          {steps.map((step, i) => (
            <li key={step.label} className="flex items-center gap-2 sm:gap-2.5">
              {i > 0 && <span className="h-px w-3 bg-stone-300 sm:w-6" aria-hidden />}
              <button
                type="button"
                onClick={step.onOpen}
                disabled={!step.onOpen}
                aria-current={step.state === "current" ? "step" : undefined}
                aria-label={`${step.label}${step.state === "current" ? " (current step)" : step.state === "done" ? " (done)" : ""}`}
                className="flex min-h-11 items-center gap-2 px-1 enabled:cursor-pointer enabled:hover:[&>span:last-child]:underline"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[13px]",
                    step.state === "done"
                      ? "bg-[#eef0e9]"
                      : step.state === "current"
                        ? "bg-stone-950 text-white"
                        : "border border-stone-300 text-stone-500",
                  )}
                >
                  {step.state === "done" ? <DoneMark className="size-3.5 stroke-[#3a4536]" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[14px] underline-offset-[3px]",
                    step.state === "current" ? "hidden font-medium text-stone-950 md:inline" : "hidden xl:inline",
                    step.state === "done" ? "text-stone-700" : step.state === "todo" && "text-stone-500",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <span className="hidden justify-self-end font-mono text-[12px] tracking-[0.1em] text-stone-600 uppercase sm:block">
        {counter}
      </span>
    </header>
  )
}

export function Display({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "m-0 font-serif text-[40px] leading-[1.02] font-light tracking-[-0.025em] sm:text-[56px]",
        className,
      )}
      {...props}
    />
  )
}

export function FlowTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "m-0 font-serif text-[32px] leading-[1.05] font-light tracking-[-0.02em] sm:text-[40px]",
        className,
      )}
      {...props}
    />
  )
}

export function MonoLabel({ className, ...props }: ComponentProps<"span">) {
  return (
    <span className={cn("font-mono text-[12px] tracking-[0.1em] text-stone-600 uppercase", className)} {...props} />
  )
}

export function PrimaryButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "flex h-[52px] items-center justify-center gap-2 bg-stone-950 px-8 text-[16px] font-medium text-white hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-500",
        className,
      )}
      {...props}
    />
  )
}

export function SecondaryButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "flex h-[52px] items-center justify-center gap-2 border border-stone-950/16 bg-white px-6 text-[16px] font-medium hover:border-stone-950",
        className,
      )}
      {...props}
    />
  )
}

export function QuietButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "flex h-11 items-center justify-center text-[14px] text-stone-600 underline underline-offset-[3px] hover:text-stone-950",
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  id,
  label,
  className,
  ...props
}: ComponentProps<"input"> & { id: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-medium">
        {label}
      </label>
      <input
        id={id}
        className={cn(
          "h-[52px] rounded-none border border-stone-950/16 bg-transparent px-4 text-[16px] text-stone-950 outline-none placeholder:text-stone-500 focus:border-stone-950",
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[#c2410c]">
      {children}
    </p>
  )
}

export function StepBars({ filled, partial }: { filled: number; partial?: number }) {
  return (
    <div className="grid grid-cols-3 gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="relative h-1 overflow-hidden bg-stone-200">
          <span
            className="absolute inset-y-0 left-0 bg-stone-950 transition-[width] duration-300"
            style={{ width: i < filled ? "100%" : i === filled && partial ? `${Math.round(partial * 100)}%` : "0%" }}
          />
        </span>
      ))}
    </div>
  )
}

export function DoneMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4d5a48"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      aria-label="Done"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
