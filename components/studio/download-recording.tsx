"use client"

import { useState } from "react"
import type { User } from "firebase/auth"

import { ErrorText, PrimaryButton, SecondaryButton } from "@/components/studio/ui"
import { ApiError, apiError, describeLoadError } from "@/lib/studio/errors"

// Saves a submission's original recording through /api/admin/recording,
// which needs the admin's token in a header, so it can't be a plain link.
// The whole file is held in memory as a Blob before the save dialog opens
// (the route streams, the browser side doesn't); recordings are capped at
// 500 MB by the storage rules, which is fine for that.
async function fetchRecording(user: User, id: string): Promise<{ blob: Blob; filename: string }> {
  const token = await user.getIdToken()
  const response = await fetch(`/api/admin/recording?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw apiError("/api/admin/recording", response.status, await response.text())
  const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "recording.mp4"
  // The headers arrived, so the connection was fine: a body that fails from
  // here is the bucket read breaking mid-way (the route logs it), not the
  // admin's internet.
  let blob: Blob
  try {
    blob = await response.blob()
  } catch (error) {
    console.error(`Download of ${id} was cut off`, error)
    throw new ApiError("The download was cut off before the file finished. Try again; if it keeps happening, open the folder in Firebase.")
  }
  return { blob, filename }
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
      console.error(`Download of ${id} failed`, e)
      setError(e instanceof ApiError ? e.message : describeLoadError(e))
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
