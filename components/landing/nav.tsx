"use client"

import { Logo } from "@/components/landing/logo"

const LINKS = [
  { href: "#samples", label: "Samples" },
  { href: "#how-it-works", label: "How it works" },
]

function Nav() {
  return (
    <nav className="sticky top-0 z-20 flex items-center justify-between gap-3 sm:gap-6 border-b border-stone-950/8 bg-white/85 px-(--page-pad) py-[18px] backdrop-blur-md">
      <a
        href="#top"
        aria-label="VisaFlo Studio, back to top"
        className="flex shrink-0"
        onClick={(event) => {
          // Scroll the whole page up, banner included, and leave the URL clean.
          // "auto" lets the CSS scroll-behavior (and its reduced-motion override) decide.
          event.preventDefault()
          window.scrollTo({ top: 0, behavior: "auto" })
          history.replaceState(null, "", location.pathname + location.search)
        }}
      >
        <Logo />
      </a>
      <div className="flex items-center gap-7 text-[14px] text-stone-600">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="hidden whitespace-nowrap hover:text-stone-950 sm:block"
          >
            {link.label}
          </a>
        ))}
        <a
          href="#waitlist"
          className="flex h-9 items-center bg-stone-950 px-4 font-light whitespace-nowrap text-white hover:bg-stone-800"
        >
          Get my sample video
        </a>
      </div>
    </nav>
  )
}

export { Nav }
