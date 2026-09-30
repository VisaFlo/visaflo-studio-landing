import { Logo } from "@/components/landing/logo"

function Nav() {
  return (
    <nav className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-stone-950/8 bg-white/85 px-(--page-pad) py-[18px] backdrop-blur-md">
      <a href="#top" className="flex shrink-0">
        <Logo />
      </a>
      <div className="flex items-center gap-7 text-[14px] text-stone-600">
        <a href="#samples" className="hidden text-stone-600 hover:text-stone-700 sm:block">
          Samples
        </a>
        <a
          href="#waitlist"
          className="flex h-9 items-center rounded-full bg-stone-950 px-4 font-medium whitespace-nowrap text-white"
        >
          Join waitlist
        </a>
      </div>
    </nav>
  )
}

export { Nav }
