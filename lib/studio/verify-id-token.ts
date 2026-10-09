import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose"

const PROJECT_ID = "devdashboard-c9159"

// Firebase ID tokens are JWTs signed by Google's securetoken service, so a
// public key set is all it takes to check one: no service account here.
const KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
)

export type VerifiedUser = { uid: string; email?: string }

export async function verifyIdToken(token: string): Promise<VerifiedUser> {
  // Local QA against the Auth emulator, whose tokens are unsigned.
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST) {
    const claims = decodeJwt(token)
    if (!claims.sub) throw new Error("Token has no subject")
    return { uid: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined }
  }
  const { payload } = await jwtVerify(token, KEYS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  })
  if (!payload.sub) throw new Error("Token has no subject")
  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? ""
  return header.startsWith("Bearer ") ? header.slice(7) : null
}
