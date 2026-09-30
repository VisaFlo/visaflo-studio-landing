import { Logo } from "@/components/landing/logo"

function Footer() {
  return (
    <footer className="flex flex-col items-center gap-3 px-(--page-pad) py-10 text-center text-[13px] text-stone-500">
      <Logo size="footer" />
      <div>© 2026</div>
    </footer>
  )
}

export { Footer }
