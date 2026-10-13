import type { Metadata } from "next"

import { Admin } from "@/components/studio/admin"

export const metadata: Metadata = {
  title: "Admin | VisaFlo Studio",
  robots: { index: false },
}

export default function AdminPage() {
  return <Admin />
}
