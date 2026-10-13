import { isPlainObject } from "@/lib/studio/checks"

// Words for the person when a Firebase call or a fetch fails. A Firebase
// error carries a code, which is shown so it can be looked up; its message is
// never shown. A fetch that never reached the server is a TypeError whose
// message says so. Only a network problem is fixed by trying again, so each
// message says which it was.

/** What one of our API routes answered: a message written for the person, safe to show as is. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiError"
  }
}

// The body of an answer from one of our routes, as an object. Anything else
// (a gateway's HTML page, a bare JSON value) is logged with its status.
export function parseJsonObject(path: string, status: number, raw: string): Record<string, unknown> | null {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    console.error(`${path} answered with something other than JSON`, status, raw.slice(0, 300))
    return null
  }
  if (isPlainObject(body)) return body
  console.error(`${path} answered with JSON that isn't an object`, status, raw.slice(0, 300))
  return null
}

// The body of a failed answer from one of our routes. Only a non-empty string
// `error` is the route's own wording and is shown; any other body (a platform
// error object, a gateway page) is logged with its status and replaced.
export function apiError(path: string, status: number, raw: string): ApiError {
  const fallback = `Request failed (${status}). Try again.`
  const body = parseJsonObject(path, status, raw)
  const message = typeof body?.error === "string" ? body.error.trim() : ""
  if (body && !message) console.error(`${path} answered without a usable error message`, status, raw.slice(0, 300))
  return new ApiError(message || fallback)
}

const code = (error: unknown): unknown => (error as { code?: unknown } | null)?.code

// fetch() rejects with a TypeError when the request never got an answer; the
// message is browser-specific ("Failed to fetch", "Load failed",
// "NetworkError when attempting to fetch resource."). Only a TypeError with
// fetch's own words counts, so an Error of ours that happens to mention the
// network does not match.
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

/** Why the recording upload failed, for the banner: only a retry-limit failure is called a connection problem. */
export type UploadFailure = { reason: "network" } | { reason: "refused" } | { reason: "other"; code: string }

export function uploadFailureReason(error: unknown): UploadFailure {
  const c = code(error)
  if (c === "storage/unauthorized" || c === "storage/unauthenticated") return { reason: "refused" }
  if (c === "storage/retry-limit-exceeded") return { reason: "network" }
  return { reason: "other", code: typeof c === "string" ? c : error instanceof Error ? error.name : "no code" }
}
