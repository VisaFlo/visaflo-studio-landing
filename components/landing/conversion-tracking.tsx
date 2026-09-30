"use client"

import { useEffect } from "react"

import { trackStudioEvent } from "@/lib/analytics"

function ConversionTracking() {
  useEffect(() => {
    const trackLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const link = event.target.closest<HTMLAnchorElement>("a[href]")
      if (!link) return

      const ctaLocation = link.closest("nav")
        ? "nav"
        : link.closest("#top")
          ? "hero"
          : "page"

      if (link.getAttribute("href") === "#waitlist") {
        trackStudioEvent("studio_cta_click", { cta_location: ctaLocation })
      } else if (link.getAttribute("href") === "#samples") {
        trackStudioEvent("studio_samples_click", { cta_location: ctaLocation })
      }
    }

    document.addEventListener("click", trackLink, true)
    return () => document.removeEventListener("click", trackLink, true)
  }, [])

  return null
}

export { ConversionTracking }
