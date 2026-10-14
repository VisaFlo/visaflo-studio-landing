import type { Metadata } from "next"

import { DemoStudio } from "@/components/demo/demo-studio"

export const metadata: Metadata = {
  title: "Create | VisaFlo Studio",
  robots: { index: false },
}

export default function DemoPage() {
  return <DemoStudio />
}
