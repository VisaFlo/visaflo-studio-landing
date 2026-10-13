import type { User } from "firebase/auth"

import { apiError } from "@/lib/studio/errors"

// Deletes one submission through DELETE /api/admin/submissions. A refusal
// throws an ApiError with the route's own message (which names any file it
// couldn't delete); a request that never got an answer rejects as fetch did.
export async function deleteSubmission(user: Pick<User, "getIdToken">, id: string): Promise<void> {
  const token = await user.getIdToken()
  const response = await fetch(`/api/admin/submissions?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw apiError("/api/admin/submissions", response.status, await response.text())
}
