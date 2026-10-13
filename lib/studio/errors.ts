// Words for the person when a Firebase call or a fetch fails. Firebase errors
// carry a code; a fetch that never reached the server is a TypeError whose
// message says so. Only a network problem is fixed by trying again, so each
// message says which it was and never shows the SDK's own text.

/** What one of our API routes answered: a message written for the person, safe to show as is. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiError"
  }
}

// The body of a failed answer from one of our routes. Only a string `error`
// is the route's own wording; anything else (a platform error object, a
// gateway's HTML page) is logged with its status and replaced.
export function apiError(path: string, status: number, raw: string): ApiError {
  const fallback = `Request failed (${status}). Try again.`
  try {
    const body = JSON.parse(raw) as { error?: unknown }
    return new ApiError(typeof body.error === "string" ? body.error : fallback)
  } catch {
    console.error(`${path} answered with something other than JSON`, status, raw.slice(0, 300))
    return new ApiError(fallback)
  }
}

const code = (error: unknown): unknown => (error as { code?: unknown } | null)?.code

// fetch() rejects with a TypeError when the request never got an answer; the
// message is browser-specific ("Failed to fetch", "Load failed",
// "NetworkError when attempting to fetch resource."). A TypeError from our
// own code is a bug, not a connection problem, so it must not match.
const offline = (error: unknown) =>
  code(error) === "auth/network-request-failed" || (error instanceof TypeError && /fetch|network|load failed/i.test(error.message))

const deadSession = (error: unknown) => {
  const c = code(error)
  return c === "auth/user-token-expired" || c === "auth/user-disabled" || c === "auth/invalid-user-token"
}

const DEAD_SESSION = "Your session is no longer valid. Sign out and sign in again."

// Loading an admin page.
export function describeLoadError(error: unknown): string {
  if (offline(error)) return "No connection. Check your internet, then reload."
  if (deadSession(error)) return DEAD_SESSION
  const c = code(error)
  const what = typeof c === "string" ? c : error instanceof Error ? error.message : ""
  return what ? `Something went wrong (${what}). Reload to try again.` : "Something went wrong. Reload to try again."
}

// Sending the sample request (request.json upload, then the API call).
export function describeSubmitError(error: unknown): string {
  const c = code(error)
  if (c === "storage/unauthorized" || c === "storage/unauthenticated") return "We couldn't save your request. Sign out and back in, then retry."
  if (deadSession(error)) return DEAD_SESSION
  if (offline(error)) return "No connection. Check your internet, then retry."
  return typeof c === "string" ? `We couldn't send your request (${c}). Try again.` : "We couldn't send your request. Try again."
}
