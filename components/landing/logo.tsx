import Image from "next/image"

import { cn } from "@/lib/utils"

function Logo({
  size = "nav",
  inverted = false,
  className,
}: {
  size?: "nav" | "footer"
  /** White mark with a black V, for dark backgrounds. */
  inverted?: boolean
  className?: string
}) {
  // The nav shows the "Studio" badge; the footer shows the VisaFlo mark.
  const isNav = size === "nav"

  return (
    <span
      className={cn(
        "flex items-center gap-2.5 font-serif tracking-[-0.01em] text-stone-950",
        isNav ? "text-[24px]" : "text-[20px]",
        className
      )}
    >
      {!isNav && (
        <Image
          src={inverted ? "/visaflo-logo-inverted.png" : "/visaflo-logo.png"}
          alt=""
          width={26}
          height={26}
          className="block rounded-sm"
        />
      )}
      <span className="translate-y-[0.1em]">VisaFlo</span>
      {isNav && (
        <span className="border border-stone-950 px-2 pt-1 pb-px text-[16px] text-stone-700">
          Studio
        </span>
      )}
    </span>
  )
}

export { Logo }
