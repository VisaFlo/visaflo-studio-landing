import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignIn } from "@/components/studio/sign-in"
import { returnPath } from "@/lib/studio/return-path"

export const metadata: Metadata = {
  title: "Sign in | VisaFlo Studio",
  robots: { index: false },
}

// Only the admin pages send people here. Anyone else (say, from an older
// email's "record your sample" link) records on /start without an account.
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (!returnPath((await searchParams).next)) redirect("/start")
  return <SignIn />
}
