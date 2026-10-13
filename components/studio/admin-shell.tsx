"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { User } from "firebase/auth"

import { AccountHeader, ErrorText, Page } from "@/components/studio/ui"
import { signOutOfStudio, useStudioUser } from "@/lib/studio/auth"
import { initials } from "@/lib/studio/profile"

// Every admin page: wait for the session, bounce to sign-in (and back), then
// hand the signed-in person to the page. Whether they are a VisaFlo master is
// only known to the server, so a non-master sees the API's refusal on the
// page itself. `path` is where sign-in returns to; only /admin paths survive
// returnPath, hence the type.
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
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    if (user === null) router.replace(`/signin?next=${encodeURIComponent(path)}`)
  }, [user, router, path])

  async function signOut() {
    setSignOutError(null)
    try {
      await signOutOfStudio()
    } catch (error) {
      // Still signed in: say so, or the button looks broken.
      console.error("Sign-out failed", error)
      setSignOutError("We couldn't sign you out. Reload the page and try again.")
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
  const header = (
    <>
      <AccountHeader email={email} initials={initials("", email)} onSignOut={() => void signOut()} />
      {signOutError && (
        <div className="mx-auto w-full max-w-[1400px] px-(--page-pad) pt-3">
          <ErrorText>{signOutError}</ErrorText>
        </div>
      )}
    </>
  )

  return (
    <Page>
      {header}
      <main className={`mx-auto flex w-full ${wide ? "max-w-[1400px]" : "max-w-[1120px]"} flex-grow flex-col gap-8 px-(--page-pad) py-10 sm:py-14`}>
        {children(user)}
      </main>
    </Page>
  )
}

export function Tag({ tone, title, children }: { tone: "muted" | "warn" | "ok"; title?: string; children: string }) {
  const color = tone === "warn" ? "bg-[#fff1e6] text-[#9a3412]" : tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"
  return (
    <span title={title} className={`px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${color}`}>
      {children}
    </span>
  )
}
