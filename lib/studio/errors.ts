// Words for the person when a Firebase call or a fetch fails. Firebase errors
// carry a code; a fetch that never reached the server is a TypeError. Only a
// network problem is fixed by trying again, so each message says which it was
// and never shows the SDK's own text.

const code = (error: unknown): unknown => (error as { code?: unknown } | null)?.code
const offline = (error: unknown) => code(error) === "auth/network-request-failed" || error instanceof TypeError

// Loading an admin page.
export function describeLoadError(error: unknown): string {
  if (offline(error)) return "No connection. Check your internet, then reload."
  const c = code(error)
  if (c === "auth/user-token-expired" || c === "auth/user-disabled" || c === "auth/invalid-user-token") {
    return "Your session is no longer valid. Sign out and sign in again."
  }
  const what = typeof c === "string" ? c : error instanceof Error ? error.message : ""
  return what ? `Something went wrong (${what}). Reload to try again.` : "Something went wrong. Reload to try again."
}

// Sending the sample request (request.json upload, then the API call).
export function describeSubmitError(error: unknown): string {
  const c = code(error)
  if (c === "storage/unauthorized" || c === "storage/unauthenticated") return "We couldn't save your request. Sign out and back in, then retry."
  if (offline(error)) return "No connection. Check your internet, then retry."
  return "We couldn't send your request. Try again."
}
