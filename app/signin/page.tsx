import type { Metadata } from "next"

import { SignIn } from "@/components/studio/sign-in"

export const metadata: Metadata = {
  title: "Sign in | VisaFlo Studio",
  robots: { index: false },
}

export default function SignInPage() {
  return <SignIn />
}
