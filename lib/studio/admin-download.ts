import type { User } from "firebase/auth"

import { ApiError, apiError } from "@/lib/studio/errors"

// Fetches a submission's original recording through /api/admin/recording,
// which needs the admin's token in a header, so it can't be a plain link.
// The whole file is held in memory as a Blob before the save dialog opens
// (the route streams, the browser side doesn't); recordings are capped at
// 500 MB by the storage rules, which is fine for that.
export async function fetchRecording(user: User, id: string): Promise<{ blob: Blob; filename: string }> {
  const token = await user.getIdToken()
  const response = await fetch(`/api/admin/recording?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw apiError("/api/admin/recording", response.status, await response.text())
  const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "recording.mp4"
  // The headers arrived, so the request was authorised and the route found
  // the file: a body that fails from here is the transfer breaking mid-way
  // (the bucket read, which the route logs, or the admin's own connection
  // dropping during a large file). Reported as cut off rather than as a
  // sign-in or "no connection" problem, which describeLoadError would say.
  let blob: Blob
  try {
    blob = await response.blob()
  } catch (error) {
    console.error(`Download of ${id} was cut off`, error)
    throw new ApiError("The download was cut off before the file finished. Try again; if it keeps happening, open the folder in Firebase.")
  }
  return { blob, filename }
}
