"use client"

import type { User } from "firebase/auth"

import type { Script, ScriptFile } from "@/lib/studio/sample/script"
import type { SampleOptions, SampleStatus, Stage } from "@/lib/studio/sample/status"

// The admin page talks to /api/admin/sample/* with a fresh ID token each time.
export async function sampleApi<T>(user: User, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const token = await user.getIdToken()
  const response = await fetch(`/api/admin/sample/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(json?.error ?? `Request failed (${response.status})`)
  return json as T
}

const q = (id: string) => `id=${encodeURIComponent(id)}`

export const getStatus = (user: User, id: string) => sampleApi<SampleStatus>(user, "GET", `status?${q(id)}`)
export const poll = (user: User, id: string) => sampleApi<SampleStatus>(user, "GET", `poll?${q(id)}`)
export const saveOptions = (user: User, id: string, options: Partial<SampleOptions>) =>
  sampleApi<SampleStatus>(user, "PUT", "options", { id, options })
export const runStage = (user: User, id: string, stage: Stage, body: Record<string, unknown> = {}) =>
  sampleApi<SampleStatus>(user, "POST", `run/${stage}`, { id, ...body })
export const getScript = (user: User, id: string) => sampleApi<ScriptFile | null>(user, "GET", `script?${q(id)}`)
export const saveScript = (user: User, id: string, draft: Script, approved: boolean) =>
  sampleApi<{ status: SampleStatus; script: ScriptFile }>(user, "PUT", "script", { id, draft, approved })
