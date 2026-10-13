"use client"

import { useState } from "react"
import Link from "next/link"
import type { User } from "firebase/auth"

import { topicFallback } from "@/components/studio/admin"
import { AdminShell, Tag, VerifyEmail } from "@/components/studio/admin-shell"
import { DownloadRecording } from "@/components/studio/download-recording"
import { Display, ErrorText, MonoLabel } from "@/components/studio/ui"
import type { Submission } from "@/lib/studio/admin"
import { useAdminLoad } from "@/lib/studio/admin-client"
import { clipLength, describeProblems, fileInfo, when } from "@/lib/studio/admin-format"
import { checkFlags } from "@/lib/studio/checks"

const pickSubmission = (body: Record<string, unknown>) =>
  body.submission && typeof body.submission === "object" ? (body.submission as Submission) : undefined

// One submission: who they are, the recording, and a button to save the
// original file. Sample videos are made by hand from that download.
export function SubmissionPage({ id }: { id: string }) {
  return (
    <AdminShell path={`/admin/${id}`} wide>
      {(user) => <SubmissionBody user={user} id={id} />}
    </AdminShell>
  )
}

function SubmissionBody({ user, id }: { user: User; id: string }) {
  const { load, reload } = useAdminLoad(user, `/api/admin/submissions?id=${encodeURIComponent(id)}`, pickSubmission)
  const [playerError, setPlayerError] = useState(false)

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
        <VerifyEmail user={user} onVerified={reload} />
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

  const s = load.data
  const title = [s.name, s.firm].filter(Boolean).join(" · ") || s.email || s.uid
  // Checks travel in request.json, so only a finished request can be missing them.
  const flags = s.status === "requested" ? checkFlags(s.checks) : []
  const rows: [string, string][] = [
    ["Email", s.email ?? "—"],
    ["Topic", s.topicTitle ?? topicFallback(s.status)],
    ["Recorded", when(s.recordedAt)],
    ["Requested", when(s.requestedAt)],
    ["Length", clipLength(s.seconds)],
    ["File", fileInfo(s.recording)],
    ["Consent", s.consentAt ? `Agreed ${when(s.consentAt)}` : "—"],
    ["Folder", `studio/${s.uid}/${s.submissionId}`],
  ]
  const playable = s.recording?.url && !playerError

  return (
    <>
      {back}
      <header className="flex flex-col gap-3">
        <MonoLabel>Submission</MonoLabel>
        <Display>{title}</Display>
        <div className="flex flex-wrap gap-2">
          {s.status === "requested" && <Tag tone="ok">Topic picked</Tag>}
          {s.status === "recorded" && <Tag tone="muted">Recorded only</Tag>}
          {flags.map((f) => (
            <Tag key={f} tone="warn">
              {f}
            </Tag>
          ))}
          {s.problems.length > 0 && <Tag tone="warn">Read problem</Tag>}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 border border-stone-200 p-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        {playable ? (
          <video
            src={s.recording?.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[480px] max-w-full bg-stone-950"
            onError={() => setPlayerError(true)}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-stone-100 p-4 text-center text-[14px] text-stone-600">
            {playerError
              ? "The recording couldn't be played here. Download it, or open the folder in Firebase."
              : s.recording
                ? "No playable link for this recording. Download it, or open the folder in Firebase."
                : "No recording in this folder."}
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
          {s.problems.length > 0 && <ErrorText>{describeProblems(s.problems)}</ErrorText>}
          {s.recording && (
            <div>
              <DownloadRecording user={user} id={s.id} />
            </div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            {s.recording?.url && (
              <a href={s.recording.url} target="_blank" rel="noreferrer" className="underline underline-offset-[3px]">
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
    </>
  )
}
