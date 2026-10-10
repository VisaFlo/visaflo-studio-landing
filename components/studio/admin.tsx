"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { sendEmailVerification, type User } from "firebase/auth"

import { AccountHeader, Display, ErrorText, MonoLabel, Page, SecondaryButton } from "@/components/studio/ui"
import { isStudioAdmin, type Submission } from "@/lib/studio/admin"
import { signOutOfStudio, useStudioUser } from "@/lib/studio/auth"
import { initials } from "@/lib/studio/profile"
import { cn } from "@/lib/utils"

type Load =
  | { status: "loading" }
  | { status: "ready"; submissions: Submission[] }
  | { status: "unverified" }
  | { status: "error"; message: string }

function when(iso?: string): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—"
  return new Date(iso).toLocaleString("en-CA", { timeZone: "America/Vancouver", dateStyle: "medium", timeStyle: "short" })
}

function length(seconds?: number): string {
  if (!seconds) return "—"
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

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

export function Admin() {
  const router = useRouter()
  const user = useStudioUser()
  const [load, setLoad] = useState<Load>({ status: "loading" })

  useEffect(() => {
    if (user === null) router.replace("/signin?next=/admin")
  }, [user, router])

  const admin = Boolean(user && isStudioAdmin(user.email))
  useEffect(() => {
    if (!user || !admin) return
    let cancelled = false
    void requestSubmissions(user).then((result) => {
      if (!cancelled) setLoad(result)
    })
    return () => {
      cancelled = true
    }
  }, [user, admin])

  function reload() {
    if (!user) return
    setLoad({ status: "loading" })
    void requestSubmissions(user).then(setLoad)
  }

  async function signOut() {
    await signOutOfStudio()
    router.replace("/signin?next=/admin")
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

  if (!admin) {
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
      <main className="mx-auto flex w-full max-w-[1120px] flex-grow flex-col gap-8 px-(--page-pad) py-10 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <MonoLabel>Studio admin</MonoLabel>
            <Display>Face and voice</Display>
          </div>
          <SecondaryButton
            type="button"
            className="h-11 px-4 text-[14px]"
            disabled={load.status === "loading"}
            onClick={reload}
          >
            {load.status === "loading" ? "Loading…" : "Reload"}
          </SecondaryButton>
        </div>

        {load.status === "unverified" && <VerifyEmail user={user} onVerified={reload} />}
        {load.status === "error" && <ErrorText>{load.message}</ErrorText>}
        {load.status === "ready" && <SubmissionList submissions={load.submissions} />}
      </main>
    </Page>
  )
}

function VerifyEmail({ user, onVerified }: { user: User; onVerified: () => void }) {
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
        <SecondaryButton
          type="button"
          className="h-11 px-4 text-[14px]"
          onClick={() => void user.reload().then(onVerified)}
        >
          I&apos;ve verified it
        </SecondaryButton>
      </div>
    </div>
  )
}

function SubmissionList({ submissions }: { submissions: Submission[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!submissions.length) {
    return <p className="m-0 text-[16px] text-stone-600">No recordings yet.</p>
  }
  const requested = submissions.filter((s) => s.status === "requested").length
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[14px] text-stone-600">
        {submissions.length} recording{submissions.length === 1 ? "" : "s"} · {requested} with a topic picked ·{" "}
        {submissions.length - requested} recorded only
      </p>
      <ul className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
        {submissions.map((s) => (
          <SubmissionRow
            key={s.id}
            submission={s}
            open={open === s.id}
            onToggle={() => setOpen((current) => (current === s.id ? null : s.id))}
          />
        ))}
      </ul>
    </div>
  )
}

function SubmissionRow({ submission: s, open, onToggle }: { submission: Submission; open: boolean; onToggle: () => void }) {
  const flags = s.checks
    ? [!s.checks.faceSeen && "No face seen", !s.checks.voiceHeard && "No voice heard", !s.checks.headTurn && "Head turn skipped"].filter(
        (f): f is string => Boolean(f),
      )
    : []
  return (
    <li className="border-b border-stone-200">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid w-full grid-cols-1 gap-x-6 gap-y-1 py-4 text-left hover:bg-stone-50 sm:grid-cols-[150px_1fr_auto] sm:items-center"
      >
        <span className="text-[14px] text-stone-600">{when(s.requestedAt ?? s.recordedAt)}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[16px] font-medium">
            {[s.name, s.firm].filter(Boolean).join(" · ") || s.email || s.uid}
          </span>
          <span className="truncate text-[14px] text-stone-600">
            {s.topicTitle ?? "No topic picked yet"} · {length(s.seconds)}
            {s.name || s.firm ? ` · ${s.email ?? ""}` : ""}
          </span>
        </span>
        <span className="flex flex-wrap gap-2">
          {s.status === "recorded" && <Tag tone="muted">Recorded only</Tag>}
          {flags.map((f) => (
            <Tag key={f} tone="warn">
              {f}
            </Tag>
          ))}
          {s.problem && <Tag tone="warn">Read problem</Tag>}
        </span>
      </button>
      {open && <SubmissionDetail submission={s} />}
    </li>
  )
}

function Tag({ tone, children }: { tone: "muted" | "warn"; children: string }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
        tone === "warn" ? "bg-[#fff1e6] text-[#9a3412]" : "bg-stone-100 text-stone-600",
      )}
    >
      {children}
    </span>
  )
}

function SubmissionDetail({ submission: s }: { submission: Submission }) {
  const checks = s.checks
    ? [
        s.checks.faceSeen ? "face seen" : "NO FACE SEEN",
        s.checks.voiceHeard ? "voice heard" : "NO VOICE HEARD",
        s.checks.headTurn ? "head turn done" : "head turn skipped",
      ].join(", ")
    : "—"
  const rows: [string, string][] = [
    ["Email", s.email ?? "—"],
    ["Name", s.name ?? "—"],
    ["Firm", s.firm ?? "—"],
    ["Topic", s.topicTitle ?? "Not picked yet"],
    ["Length", length(s.seconds)],
    ["Checks", checks],
    ["Consent", s.consentAt ? `Agreed ${when(s.consentAt)}` : "—"],
    ["Recorded", when(s.recordedAt)],
    ["Requested", when(s.requestedAt)],
    ["File", s.video ? `${s.video.contentType}, ${megabytes(s.video.bytes)}` : "—"],
    ["VisaFlo uid", s.uid],
    ["Submission", s.submissionId],
  ]
  return (
    <div className="grid grid-cols-1 gap-6 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {s.video ? (
        <video
          src={s.video.url}
          controls
          playsInline
          preload="metadata"
          className="max-h-[70vh] w-full bg-stone-950 object-contain"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-stone-100 text-[14px] text-stone-600">
          No playable video. Open the folder in Firebase.
        </div>
      )}
      <div className="flex flex-col gap-5">
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
              Open video
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
    </div>
  )
}
