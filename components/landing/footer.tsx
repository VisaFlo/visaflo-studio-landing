import { Logo } from "@/components/landing/logo"

function Footer() {
  return (
    <footer className="flex flex-col items-center gap-3 bg-stone-950 px-(--page-pad) py-12 text-center text-[13px] text-stone-500">
      <Logo size="footer" inverted className="text-white" />
      <div>© 2026</div>
    </footer>
  )
}

export { Footer }
