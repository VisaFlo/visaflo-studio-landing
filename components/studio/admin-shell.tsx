"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { sendEmailVerification, type User } from "firebase/auth"

import { AccountHeader, Display, ErrorText, Page, SecondaryButton } from "@/components/studio/ui"
import { isStudioAdmin } from "@/lib/studio/admin"
import { signOutOfStudio, useStudioUser } from "@/lib/studio/auth"
import { initials } from "@/lib/studio/profile"

// Every admin page: wait for the session, bounce to sign-in (and back), keep
// non-admins out, then hand the signed-in admin to the page. `path` is where
// sign-in returns to; only /admin paths survive returnPath, hence the type.
export function AdminShell({
  path,
  wide,
  children,
}: {
  path: `/admin${string}`
  wide?: boolean
  children: (user: User) => ReactNode
}) {
  const router = useRouter()
  const user = useStudioUser()

  useEffect(() => {
    if (user === null) router.replace(`/signin?next=${encodeURIComponent(path)}`)
  }, [user, router, path])

  async function signOut() {
    try {
      await signOutOfStudio()
    } catch (error) {
      // Still signed in; the next page load would just bounce back here.
      console.error("Sign-out failed", error)
      return
    }
    router.replace(`/signin?next=${encodeURIComponent(path)}`)
  }

  if (!user) {
    return (
      <Page>
        <AccountHeader />
        <main className="flex flex-grow items-center justify-center text-[14px] text-stone-500">Loading…</main>
      </Page>
    )
  }

  const email = user.email ?? ""
  const header = <AccountHeader email={email} initials={initials("", email)} onSignOut={() => void signOut()} />

  if (!isStudioAdmin(user.email)) {
    return (
      <Page>
        {header}
        <main className="mx-auto flex w-full max-w-[528px] flex-grow flex-col gap-4 px-(--page-pad) pt-12 sm:pt-24">
          <Display>Admin only</Display>
          <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
            {email} can&apos;t open this page. Sign out and sign in with the Studio admin account.
          </p>
        </main>
      </Page>
    )
  }

  return (
    <Page>
      {header}
      <main className={`mx-auto flex w-full ${wide ? "max-w-[1400px]" : "max-w-[1120px]"} flex-grow flex-col gap-8 px-(--page-pad) py-10 sm:py-14`}>
        {children(user)}
      </main>
    </Page>
  )
}

// `onVerified` runs only once the account really is verified; the caller
// re-requests the page then (the User object is updated in place by
// reload(), so nothing else would notice).
export function VerifyEmail({ user, onVerified }: { user: User; onVerified: () => void }) {
  const [sent, setSent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setError(null)
    try {
      await sendEmailVerification(user)
      setSent(true)
    } catch (e) {
      console.error("sendEmailVerification failed", e)
      const code = (e as { code?: string }).code
      setError(
        code === "auth/too-many-requests"
          ? "Wait a minute, then try again."
          : code === "auth/network-request-failed"
            ? "No connection. Check your internet, then try again."
            : `We couldn't send the email (${code ?? "unknown error"}). Try again.`,
      )
    }
  }

  async function confirm() {
    setChecking(true)
    setError(null)
    try {
      await user.reload()
      if (user.emailVerified) onVerified()
      else setError("Still not verified. Open the email we sent and click its link, then try again.")
    } catch (e) {
      console.error("user.reload failed", e)
      setError("We couldn't check your account. Reload the page and try again.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 border border-stone-200 bg-stone-50 p-6">
      <p className="m-0 text-[16px] leading-[1.5]">
        Verify {user.email} before you can see recordings. We&apos;ll email you a link; open it, then come back here.
      </p>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex flex-wrap gap-3">
        <SecondaryButton type="button" className="h-11 px-4 text-[14px]" disabled={sent} onClick={() => void send()}>
          {sent ? "Email sent" : "Send verification email"}
        </SecondaryButton>
        <SecondaryButton type="button" className="h-11 px-4 text-[14px]" disabled={checking} onClick={() => void confirm()}>
          {checking ? "Checking…" : "I've verified it"}
        </SecondaryButton>
      </div>
    </div>
  )
}

export function Tag({ tone, children }: { tone: "muted" | "warn" | "ok"; children: string }) {
  const color = tone === "warn" ? "bg-[#fff1e6] text-[#9a3412]" : tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"
  return <span className={`px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${color}`}>{children}</span>
}
