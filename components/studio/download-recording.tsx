"use client"

import { useState } from "react"
import type { User } from "firebase/auth"

import { ErrorText, PrimaryButton, SecondaryButton } from "@/components/studio/ui"

// Saves a submission's original recording through /api/admin/recording,
// which needs the admin's token in a header, so it can't be a plain link.
async function fetchRecording(user: User, id: string): Promise<{ blob: Blob; filename: string }> {
  const token = await user.getIdToken()
  const response = await fetch(`/api/admin/recording?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Download failed (${response.status})`)
  }
  const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "recording.mp4"
  return { blob: await response.blob(), filename }
}

export function DownloadRecording({
  user,
  id,
  kind = "primary",
  className,
}: {
  user: User
  id: string
  kind?: "primary" | "secondary"
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Button = kind === "primary" ? PrimaryButton : SecondaryButton

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const { blob, filename } = await fetchRecording(user, id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      // Give the browser time to start the download before the URL goes.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" className={className} disabled={busy} onClick={() => void download()}>
        {busy ? "Downloading…" : "Download recording"}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </span>
  )
}
