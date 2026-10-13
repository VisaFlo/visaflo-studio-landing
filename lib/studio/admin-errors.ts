import { StorageError } from "@/lib/studio/storage"

// The Storage failure an admin can't fix from the page: the bucket refusing
// the server's service account (a revoked key, or an IAM role taken away).
// That is our configuration, not the admin's request, so it is answered as a
// 502 from upstream rather than echoed as a 401 or 403 that would read as
// "you may not". Anything else is the caller's 500.
export function storageFailure(error: unknown): Response | null {
  if (!(error instanceof StorageError) || !error.refused) return null
  return Response.json(
    { error: "Storage refused the server's service account. Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY and the account's access, then reload." },
    { status: 502 },
  )
}
