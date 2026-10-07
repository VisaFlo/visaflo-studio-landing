import type { Metadata } from "next"
import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: "Free Immigration Video Playbook | VisaFlo Studio",
  description: "50 channels. 7,558 videos. 9 video formats. Get the free Video Playbook and research kit for immigration lawyers and RCICs by email.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "50 channels. 7,558 videos. 9 video formats.",
    description: "Practical openings, filming blueprints and a brief for your next immigration video. Get the free October 2026 Video Playbook.",
    url: "https://studio.visaflo.ca/playbook",
  },
  twitter: { card: "summary_large_image" },
}

export default function PlaybookPage() {
  return <LandingPage playbookOpen />
}
