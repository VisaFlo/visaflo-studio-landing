"use client"

import { useCallback, useEffect, useState } from "react"
import type { User } from "firebase/auth"

// How an admin page loads from /api/admin/*: one state machine, one error
// vocabulary, and a `reload` that really re-requests (needed after "I've
// verified it", because `user.reload()` changes the same User in place and
// no effect dependency moves).
export type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "unverified" } | { status: "error"; message: string }

const NO_CONNECTION = "No connection. Check your internet, then reload."
const DEAD_SESSION = "Your session is no longer valid. Sign out and sign in again."

// Firebase auth errors carry a code; fetch failures are TypeErrors. Only a
// network problem is fixed by reloading, so say which it was.
export function describeLoadError(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  if (code === "auth/network-request-failed" || error instanceof TypeError) return NO_CONNECTION
  if (code === "auth/user-token-expired" || code === "auth/user-disabled" || code === "auth/invalid-user-token") return DEAD_SESSION
  const what = typeof code === "string" ? code : error instanceof Error ? error.message : ""
  return what ? `Something went wrong (${what}). Reload to try again.` : "Something went wrong. Reload to try again."
}

type Body = Record<string, unknown> & { error?: string; code?: string }

export async function adminRequest<T>(user: User, path: string, pick: (body: Body) => T | undefined): Promise<Load<T>> {
  try {
    // A fresh token, so a just-verified email counts right away.
    const token = await user.getIdToken(true)
    const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
    const body = (await response.json().catch(() => ({}))) as Body
    if (body.code === "unverified") return { status: "unverified" }
    const data = response.ok ? pick(body) : undefined
    if (data === undefined) {
      return { status: "error", message: typeof body.error === "string" ? body.error : `Request failed (${response.status}). Reload to try again.` }
    }
    return { status: "ready", data }
  } catch (error) {
    console.error(`${path} failed`, error)
    return { status: "error", message: describeLoadError(error) }
  }
}

// `pick` must be stable (declare it at module level): it is an effect dependency.
export function useAdminLoad<T>(user: User, path: string, pick: (body: Body) => T | undefined): { load: Load<T>; reload: () => void } {
  const [load, setLoad] = useState<Load<T>>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void adminRequest(user, path, pick).then((result) => {
      if (!cancelled) setLoad(result)
    })
    return () => {
      cancelled = true
    }
  }, [user, path, pick, attempt])

  const reload = useCallback(() => {
    setLoad({ status: "loading" })
    setAttempt((n) => n + 1)
  }, [])

  return { load, reload }
}
