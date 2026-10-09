import type { Metadata } from "next"

import { CaptureFlow } from "@/components/studio/capture-flow"

export const metadata: Metadata = {
  title: "Your sample video | VisaFlo Studio",
  robots: { index: false },
}

export default function StartPage() {
  return <CaptureFlow />
}
