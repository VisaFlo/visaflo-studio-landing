"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { User } from "firebase/auth"

import { AdminShell, Tag, VerifyEmail } from "@/components/studio/admin-shell"
import { SamplePanel } from "@/components/studio/sample-panel"
import { Display, ErrorText, MonoLabel } from "@/components/studio/ui"
import type { Submission } from "@/lib/studio/admin"
import { clipLength, megabytes, when } from "@/lib/studio/admin-format"

type Load =
  | { status: "loading" }
  | { status: "ready"; submission: Submission }
  | { status: "unverified" }
  | { status: "error"; message: string }

async function requestSubmission(user: User, id: string): Promise<Load> {
  try {
    const token = await user.getIdToken(true)
    const response = await fetch(`/api/admin/submissions?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
    const body = (await response.json().catch(() => ({}))) as { submission?: Submission; error?: string; code?: string }
    if (body.code === "unverified") return { status: "unverified" }
    if (!response.ok || !body.submission) return { status: "error", message: body.error ?? `Request failed (${response.status})` }
    return { status: "ready", submission: body.submission }
  } catch {
    return { status: "error", message: "No connection. Check your internet, then reload." }
  }
}

// One submission: who they are and what they recorded on top, the sample
// pipeline below.
export function SubmissionPage({ id }: { id: string }) {
  return (
    <AdminShell path={`/admin/${id}`} wide>
      {(user) => <SubmissionBody user={user} id={id} />}
    </AdminShell>
  )
}

function SubmissionBody({ user, id }: { user: User; id: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    void requestSubmission(user, id).then((r) => {
      if (!cancelled) setLoad(r)
    })
    return () => {
      cancelled = true
    }
  }, [user, id])

  const back = (
    <Link href="/admin" className="text-[14px] text-stone-600 underline underline-offset-[3px] hover:text-stone-950">
      ← All submissions
    </Link>
  )

  if (load.status === "loading") {
    return (
      <>
        {back}
        <p className="m-0 text-[14px] text-stone-500">Loading…</p>
      </>
    )
  }
  if (load.status === "unverified") {
    return (
      <>
        {back}
        <VerifyEmail user={user} onVerified={() => setLoad({ status: "loading" })} />
      </>
    )
  }
  if (load.status === "error") {
    return (
      <>
        {back}
        <ErrorText>{load.message}</ErrorText>
      </>
    )
  }

  const s = load.submission
  const title = [s.name, s.firm].filter(Boolean).join(" · ") || s.email || s.uid
  const flags = s.checks
    ? [!s.checks.faceSeen && "No face seen", !s.checks.voiceHeard && "No voice heard"].filter((f): f is string => Boolean(f))
    : []
  const rows: [string, string][] = [
    ["Email", s.email ?? "—"],
    ["Topic", s.topicTitle ?? "Not picked yet"],
    ["Recorded", when(s.recordedAt)],
    ["Requested", when(s.requestedAt)],
    ["Length", clipLength(s.seconds)],
    ["File", s.video ? `${s.video.contentType}, ${megabytes(s.video.bytes)}` : "—"],
    ["Consent", s.consentAt ? `Agreed ${when(s.consentAt)}` : "—"],
    ["Folder", `studio/${s.uid}/${s.submissionId}`],
  ]

  return (
    <>
      {back}
      <header className="flex flex-col gap-3">
        <MonoLabel>Submission</MonoLabel>
        <Display>{title}</Display>
        <div className="flex flex-wrap gap-2">
          {s.status === "recorded" ? <Tag tone="muted">Recorded only</Tag> : <Tag tone="ok">Topic picked</Tag>}
          {flags.map((f) => (
            <Tag key={f} tone="warn">
              {f}
            </Tag>
          ))}
          {s.problem && <Tag tone="warn">Read problem</Tag>}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 border border-stone-200 p-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        {s.video ? (
          <video src={s.video.url} controls playsInline preload="metadata" className="w-full bg-stone-950 object-contain" />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-stone-100 text-[14px] text-stone-600">
            No playable video. Open the folder in Firebase.
          </div>
        )}
        <div className="flex flex-col gap-4">
          <dl className="m-0 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-stone-600">{label}</dt>
                <dd className="m-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {s.consent && <p className="m-0 border-l-2 border-stone-200 pl-3 text-[13px] text-stone-600">“{s.consent}”</p>}
          {s.problem && <ErrorText>{s.problem}</ErrorText>}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            {s.video && (
              <a href={s.video.url} target="_blank" rel="noreferrer" className="underline underline-offset-[3px]">
                Open recording
              </a>
            )}
            <a href={s.consoleUrl} target="_blank" rel="noreferrer" className="underline underline-offset-[3px]">
              Open in Firebase
            </a>
            {s.email && (
              <a href={`mailto:${s.email}`} className="underline underline-offset-[3px]">
                Email them
              </a>
            )}
          </div>
        </div>
      </section>

      <SamplePanel submission={s} />
    </>
  )
}
