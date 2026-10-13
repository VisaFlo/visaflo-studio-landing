"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "firebase/auth"

import { ErrorText, SecondaryButton } from "@/components/studio/ui"
import { deleteSubmission } from "@/lib/studio/admin-delete"
import { ApiError } from "@/lib/studio/errors"

// Deletes the submission for good after a confirm, then goes back to the
// list. A failure stays on the page with the route's message, which names
// any file still there.
export function DeleteSubmission({ user, id, who }: { user: User; id: string; who: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    if (!window.confirm(`Delete ${who}'s submission? The recording and everything sent with it are removed for good.`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteSubmission(user, id)
    } catch (e) {
      console.error(`Deleting ${id} failed`, e)
      setError(e instanceof ApiError ? e.message : "We couldn't delete the submission. Check your connection, then try again.")
      setBusy(false)
      return
    }
    router.replace("/admin")
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <SecondaryButton
        type="button"
        className="h-11 px-4 text-[14px] text-[#9a3412] hover:border-[#9a3412]"
        disabled={busy}
        onClick={() => void remove()}
      >
        {busy ? "Deleting…" : "Delete submission"}
      </SecondaryButton>
      {error && <ErrorText>{error}</ErrorText>}
    </span>
  )
}
