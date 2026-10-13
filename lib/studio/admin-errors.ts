import { StorageError } from "@/lib/studio/storage"

// The two Storage failures an admin can act on. 403 is the rules refusing
// the admin's token (not published yet, or the email in them differs); 401
// is the token itself being rejected. Anything else is the caller's 500.
export function storageFailure(error: unknown): Response | null {
  if (!(error instanceof StorageError)) return null
  if (error.status === 403) {
    return Response.json(
      { error: "Storage refused the read. Publish the latest docs/studio-capture/storage.rules, then reload." },
      { status: 502 },
    )
  }
  if (error.status === 401) {
    return Response.json({ error: "Storage rejected your sign-in. Sign out and sign in again." }, { status: 401 })
  }
  return null
}
