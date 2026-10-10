"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { User } from "firebase/auth"

import { AdminShell, Tag, VerifyEmail } from "@/components/studio/admin-shell"
import { Display, ErrorText, MonoLabel, SecondaryButton } from "@/components/studio/ui"
import type { Submission } from "@/lib/studio/admin"
import { clipLength, submissionHref, when } from "@/lib/studio/admin-format"

type Load =
  | { status: "loading" }
  | { status: "ready"; submissions: Submission[] }
  | { status: "unverified" }
  | { status: "error"; message: string }

async function requestSubmissions(user: User): Promise<Load> {
  try {
    // A fresh token, so a just-verified email counts right away.
    const token = await user.getIdToken(true)
    const response = await fetch("/api/admin/submissions", { headers: { Authorization: `Bearer ${token}` } })
    const body = (await response.json().catch(() => ({}))) as { submissions?: Submission[]; error?: string; code?: string }
    if (body.code === "unverified") return { status: "unverified" }
    if (!response.ok || !body.submissions) return { status: "error", message: body.error ?? `Request failed (${response.status})` }
    return { status: "ready", submissions: body.submissions }
  } catch {
    return { status: "error", message: "No connection. Check your internet, then reload." }
  }
}

// The list. Each row is a link to its own page, where the sample is made.
export function Admin() {
  return <AdminShell path="/admin">{(user) => <AdminList user={user} />}</AdminShell>
}

function AdminList({ user }: { user: User }) {
  const [load, setLoad] = useState<Load>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    void requestSubmissions(user).then((result) => {
      if (!cancelled) setLoad(result)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  function reload() {
    setLoad({ status: "loading" })
    void requestSubmissions(user).then(setLoad)
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <MonoLabel>Studio admin</MonoLabel>
          <Display>Submissions</Display>
        </div>
        <SecondaryButton type="button" className="h-11 px-4 text-[14px]" disabled={load.status === "loading"} onClick={reload}>
          {load.status === "loading" ? "Loading…" : "Reload"}
        </SecondaryButton>
      </div>

      {load.status === "unverified" && <VerifyEmail user={user} onVerified={reload} />}
      {load.status === "error" && <ErrorText>{load.message}</ErrorText>}
      {load.status === "ready" && <SubmissionTable submissions={load.submissions} />}
    </>
  )
}

function SubmissionTable({ submissions }: { submissions: Submission[] }) {
  if (!submissions.length) return <p className="m-0 text-[16px] text-stone-600">No recordings yet.</p>
  const requested = submissions.filter((s) => s.status === "requested").length
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[14px] text-stone-600">
        {submissions.length} recording{submissions.length === 1 ? "" : "s"} · {requested} with a topic picked · {submissions.length - requested}{" "}
        recorded only
      </p>
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
            <th className="py-2 pr-4 font-medium">When</th>
            <th className="py-2 pr-4 font-medium">Who</th>
            <th className="py-2 pr-4 font-medium">Topic</th>
            <th className="py-2 pr-4 font-medium">Length</th>
            <th className="py-2 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <SubmissionRow key={s.id} submission={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SubmissionRow({ submission: s }: { submission: Submission }) {
  const flags = s.checks
    ? [!s.checks.faceSeen && "No face seen", !s.checks.voiceHeard && "No voice heard", !s.checks.headTurn && "Head turn skipped"].filter(
        (f): f is string => Boolean(f),
      )
    : []
  const href = submissionHref(s.id)
  return (
    <tr className="border-b border-stone-200 hover:bg-stone-50">
      <td className="py-3 pr-4 whitespace-nowrap text-stone-600">
        <Link href={href} className="block">
          {when(s.requestedAt ?? s.recordedAt)}
        </Link>
      </td>
      <td className="max-w-[320px] py-3 pr-4">
        <Link href={href} className="block">
          <span className="block truncate text-[15px] font-medium">{[s.name, s.firm].filter(Boolean).join(" · ") || s.email || s.uid}</span>
          {(s.name || s.firm) && <span className="block truncate text-[13px] text-stone-600">{s.email}</span>}
        </Link>
      </td>
      <td className="max-w-[280px] py-3 pr-4">
        <Link href={href} className="block truncate">
          {s.topicTitle ?? <span className="text-stone-500">No topic picked yet</span>}
        </Link>
      </td>
      <td className="py-3 pr-4 whitespace-nowrap text-stone-600">
        <Link href={href} className="block">
          {clipLength(s.seconds)}
        </Link>
      </td>
      <td className="py-3">
        <Link href={href} className="flex flex-wrap gap-2">
          {s.status === "recorded" && <Tag tone="muted">Recorded only</Tag>}
          {flags.map((f) => (
            <Tag key={f} tone="warn">
              {f}
            </Tag>
          ))}
          {s.problem && <Tag tone="warn">Read problem</Tag>}
        </Link>
      </td>
    </tr>
  )
}
