"use client"

import { useState } from "react"
import type { User } from "firebase/auth"

import { ErrorText, PrimaryButton, SecondaryButton } from "@/components/studio/ui"
import { fetchRecording } from "@/lib/studio/admin-download"
import { ApiError, describeLoadError } from "@/lib/studio/errors"

// Saves a submission's original recording, or its photo (see
// lib/studio/admin-download.ts).
export function DownloadRecording({
  user,
  id,
  file = "recording",
  kind = "primary",
  className,
}: {
  user: User
  id: string
  file?: "recording" | "photo"
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
      const { blob, filename } = await fetchRecording(user, id, file)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      // Give the browser time to start the download before the URL goes.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      console.error(`Download of the ${file} of ${id} failed`, e)
      setError(e instanceof ApiError ? e.message : describeLoadError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" className={className} disabled={busy} onClick={() => void download()}>
        {busy ? "Downloading…" : file === "photo" ? "Download photo" : "Download video"}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </span>
  )
}
