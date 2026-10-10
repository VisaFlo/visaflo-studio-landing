"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { sendEmailVerification, type User } from "firebase/auth"

import { AccountHeader, Display, ErrorText, Page, SecondaryButton } from "@/components/studio/ui"
import { isStudioAdmin } from "@/lib/studio/admin"
import { signOutOfStudio, useStudioUser } from "@/lib/studio/auth"
import { initials } from "@/lib/studio/profile"

// Every admin page: wait for the session, bounce to sign-in (and back), keep
// non-admins out, then hand the signed-in admin to the page.
export function AdminShell({ path, wide, children }: { path: string; wide?: boolean; children: (user: User) => ReactNode }) {
  const router = useRouter()
  const user = useStudioUser()

  useEffect(() => {
    if (user === null) router.replace(`/signin?next=${encodeURIComponent(path)}`)
  }, [user, router, path])

  async function signOut() {
    await signOutOfStudio()
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

export function VerifyEmail({ user, onVerified }: { user: User; onVerified: () => void }) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4 border border-stone-200 bg-stone-50 p-6">
      <p className="m-0 text-[16px] leading-[1.5]">
        Verify {user.email} before you can see recordings. We&apos;ll email you a link; open it, then come back here.
      </p>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex flex-wrap gap-3">
        <SecondaryButton
          type="button"
          className="h-11 px-4 text-[14px]"
          disabled={sent}
          onClick={() =>
            void sendEmailVerification(user)
              .then(() => setSent(true))
              .catch(() => setError("We couldn't send the email. Wait a minute, then try again."))
          }
        >
          {sent ? "Email sent" : "Send verification email"}
        </SecondaryButton>
        <SecondaryButton type="button" className="h-11 px-4 text-[14px]" onClick={() => void user.reload().then(onVerified)}>
          I&apos;ve verified it
        </SecondaryButton>
      </div>
    </div>
  )
}

export function Tag({ tone, children }: { tone: "muted" | "warn" | "ok"; children: string }) {
  const color = tone === "warn" ? "bg-[#fff1e6] text-[#9a3412]" : tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"
  return <span className={`px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${color}`}>{children}</span>
}
