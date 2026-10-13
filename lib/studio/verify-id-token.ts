import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose"

import { PROJECT_ID } from "@/lib/studio/project"

// Firebase ID tokens are JWTs signed by Google's securetoken service, so a
// public key set is all it takes to check one: no service account here.
const KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
)

export type VerifiedUser = { uid: string; email?: string; emailVerified: boolean }

export async function verifyIdToken(token: string): Promise<VerifiedUser> {
  // Local QA against the Auth emulator, whose tokens are unsigned.
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST) {
    const claims = decodeJwt(token)
    if (!claims.sub) throw new Error("Token has no subject")
    return {
      uid: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      emailVerified: claims.email_verified === true,
    }
  }
  const { payload } = await jwtVerify(token, KEYS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  })
  if (!payload.sub) throw new Error("Token has no subject")
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
  }
}

// What a failed verifyIdToken was, and what to answer. Only "expired" is the
// person's to fix by signing in again (and the one kind not worth a log line);
// "unreachable" means Google's key set couldn't be fetched, which is ours;
// "invalid" (bad signature, wrong project) is a token to discard.
export type VerifyFailure =
  | { kind: "expired"; status: 401; message: string }
  | { kind: "unreachable"; status: 503; message: string }
  | { kind: "invalid"; status: 401; message: string }

export function verifyFailure(error: unknown): VerifyFailure {
  const code = (error as { code?: unknown } | null)?.code
  if (code === "ERR_JWT_EXPIRED") return { kind: "expired", status: 401, message: "Your sign-in expired. Sign in again, then retry." }
  if ((typeof code === "string" && code.startsWith("ERR_JWKS")) || error instanceof TypeError) {
    return { kind: "unreachable", status: 503, message: "We couldn't verify your sign-in right now. Try again in a minute." }
  }
  return { kind: "invalid", status: 401, message: "We couldn't verify your sign-in. Sign out and sign in again." }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? ""
  return header.startsWith("Bearer ") ? header.slice(7) : null
}
