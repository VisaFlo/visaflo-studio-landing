"use client"

import Link from "next/link"
import type { User } from "firebase/auth"

import { AdminShell, Tag, VerifyEmail } from "@/components/studio/admin-shell"
import { DownloadRecording } from "@/components/studio/download-recording"
import { Display, ErrorText, MonoLabel, SecondaryButton } from "@/components/studio/ui"
import type { Submission } from "@/lib/studio/admin"
import { useAdminLoad } from "@/lib/studio/admin-client"
import { clipLength, describeProblems, submissionHref, when } from "@/lib/studio/admin-format"
import { checkFlags } from "@/lib/studio/checks"

const pickSubmissions = (body: Record<string, unknown>) => (Array.isArray(body.submissions) ? (body.submissions as Submission[]) : undefined)

// The list. Each row links to its own page (recording, details) and can save
// the original recording straight from here.
export function Admin() {
  return <AdminShell path="/admin">{(user) => <AdminList user={user} />}</AdminShell>
}

function AdminList({ user }: { user: User }) {
  const { load, reload } = useAdminLoad(user, "/api/admin/submissions", pickSubmissions)

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
      {load.status === "ready" && <SubmissionTable user={user} submissions={load.data} />}
    </>
  )
}

function SubmissionTable({ user, submissions }: { user: User; submissions: Submission[] }) {
  if (!submissions.length) return <p className="m-0 text-[16px] text-stone-600">No recordings yet.</p>
  const requested = submissions.filter((s) => s.status === "requested").length
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[14px] text-stone-600">
        {submissions.length} recording{submissions.length === 1 ? "" : "s"} · {requested} with a topic picked · {submissions.length - requested}{" "}
        without
      </p>
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
            <th className="py-2 pr-4 font-medium">When</th>
            <th className="py-2 pr-4 font-medium">Who</th>
            <th className="py-2 pr-4 font-medium">Topic</th>
            <th className="py-2 pr-4 font-medium">Length</th>
            <th className="py-2 pr-4 font-medium">Flags</th>
            <th className="py-2 font-medium">
              <span className="sr-only">Download</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <SubmissionRow key={s.id} user={user} submission={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// What the Topic cell says when there is no topic.
export function topicFallback(status: Submission["status"]): string {
  return status === "request-unreadable" ? "Couldn't read request.json" : "No topic picked yet"
}

function SubmissionRow({ user, submission: s }: { user: User; submission: Submission }) {
  // Checks travel in request.json, so only a finished request can be missing them.
  const flags = s.status === "requested" ? checkFlags(s.checks) : []
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
          {s.topicTitle ?? (
            <span className={s.status === "request-unreadable" ? "text-[#9a3412]" : "text-stone-500"}>{topicFallback(s.status)}</span>
          )}
        </Link>
      </td>
      <td className="py-3 pr-4 whitespace-nowrap text-stone-600">
        <Link href={href} className="block">
          {clipLength(s.seconds)}
        </Link>
      </td>
      <td className="py-3 pr-4">
        <Link href={href} className="flex flex-wrap gap-2">
          {s.status === "recorded" && <Tag tone="muted">Recorded only</Tag>}
          {flags.map((f) => (
            <Tag key={f} tone="warn">
              {f}
            </Tag>
          ))}
          {s.problems.length > 0 && (
            <Tag tone="warn" title={describeProblems(s.problems)}>
              Read problem
            </Tag>
          )}
        </Link>
      </td>
      <td className="py-2 whitespace-nowrap">
        {s.recording && <DownloadRecording user={user} id={s.id} kind="secondary" className="h-9 px-3 text-[13px]" />}
      </td>
    </tr>
  )
}
