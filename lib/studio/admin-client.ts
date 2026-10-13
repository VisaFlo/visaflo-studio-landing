"use client"

import { useCallback, useEffect, useState } from "react"
import type { User } from "firebase/auth"

import { describeLoadError, parseJsonObject } from "@/lib/studio/errors"

export type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string }

// What the API answered, as parsed: `pick` and the checks below read each
// field by type rather than trusting a declared shape.
type Body = Record<string, unknown>

type AdminPath = `/api/admin/${string}`

// One request to /api/admin/*, turned into a Load state. The body is read as
// text and parsed by hand so a non-JSON answer (a gateway's HTML timeout
// page) is logged with its status instead of vanishing into a parse error.
export async function adminRequest<T>(user: Pick<User, "getIdToken">, path: AdminPath, pick: (body: Body) => T | undefined): Promise<Load<T>> {
  try {
    const token = await user.getIdToken()
    const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
    const raw = await response.text()
    const body = parseJsonObject(path, response.status, raw)
    const data = response.ok && body ? pick(body) : undefined
    if (data !== undefined) return { status: "ready", data }
    if (response.ok) {
      // Valid JSON of the wrong shape (or a non-object or non-JSON 200, which
      // parseJsonObject logged): the API and this page disagree, so keep the
      // body for whoever looks.
      if (body) console.error(`${path} answered ${response.status} with an unexpected body`, raw.slice(0, 300))
      return { status: "error", message: "The server answered in a form this page doesn't understand. Reload to try again." }
    }
    const message = typeof body?.error === "string" ? body.error.trim() : ""
    if (body && !message) console.error(`${path} answered without a usable error message`, response.status, raw.slice(0, 300))
    return { status: "error", message: message || `Request failed (${response.status}). Reload to try again.` }
  } catch (error) {
    console.error(`${path} failed`, error)
    return { status: "error", message: describeLoadError(error) }
  }
}

// How an admin page loads: one state machine, one error vocabulary, and a
// `reload` that really re-requests (no effect dependency moves on Reload, so
// only the attempt counter can trigger a new request).
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
