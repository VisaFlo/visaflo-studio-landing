"use client"

import { useCallback, useEffect, useState } from "react"
import type { User } from "firebase/auth"

import { UNVERIFIED_CODE } from "@/lib/studio/admin"
import { describeLoadError } from "@/lib/studio/errors"

export type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "unverified" } | { status: "error"; message: string }

type Body = Record<string, unknown> & { error?: string; code?: string }

type AdminPath = `/api/admin/${string}`

// One request to /api/admin/*, turned into a Load state. The body is read as
// text first so a non-JSON answer (a gateway's HTML timeout page) is logged
// with its status instead of vanishing into a parse error.
export async function adminRequest<T>(user: User, path: AdminPath, pick: (body: Body) => T | undefined): Promise<Load<T>> {
  try {
    // A fresh token, so a just-verified email counts right away.
    const token = await user.getIdToken(true)
    const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
    const raw = await response.text()
    let body: Body = {}
    try {
      body = JSON.parse(raw) as Body
    } catch {
      console.error(`${path} answered with something other than JSON`, response.status, raw.slice(0, 300))
    }
    if (body.code === UNVERIFIED_CODE) return { status: "unverified" }
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

// How an admin page loads: one state machine, one error vocabulary, and a
// `reload` that really re-requests. That matters after "I've verified it":
// `user.reload()` changes the same User object in place, so no effect
// dependency moves and only the attempt counter can trigger a new request.
// `pick` must be stable (declare it at module level): it is an effect
// dependency, and an inline arrow would re-request on every render, forever.
export function useAdminLoad<T>(user: User, path: AdminPath, pick: (body: Body) => T | undefined): { load: Load<T>; reload: () => void } {
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
