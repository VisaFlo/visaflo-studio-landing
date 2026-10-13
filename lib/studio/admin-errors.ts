import { StorageError } from "@/lib/studio/storage"

// The two Storage failures an admin can act on. 403 is the rules refusing
// the admin's token (not published yet, or the email in them differs): that
// is our configuration, not the admin's request, so it is answered as a 502
// from upstream rather than echoed as a 403 that would read as "you may
// not". 401 is the token itself being rejected, which is the admin's to fix.
// Anything else is the caller's 500.
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
