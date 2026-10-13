import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"

import { gcsBucket } from "@/lib/studio/admin-bucket"
import { isPlainObject } from "@/lib/studio/checks"
import { BUCKET, FIRESTORE_DATABASE_ID, PROJECT_ID } from "@/lib/studio/project"
import type { StudioBucket } from "@/lib/studio/storage"

// The server's own Firebase access for /api/admin/*: the service account
// (FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, the client_email and
// private_key of its key file, as the VisaFlo backend names them) reads the caller's users/{uid}
// profile to see whether they are a VisaFlo master, then lists, reads and
// deletes recordings. It bypasses the storage rules, which is why every admin
// route checks the master flag first (lib/studio/admin-auth.ts).

/** The server isn't set up for the admin pages; the message names what is missing, never a secret. */
export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminConfigError"
  }
}

// VisaFlo staff carry `master: true` on their users doc; documents from
// before the backend's company-roles migration carry 'master' in a role
// array instead. Same rule as the backend's lib/companyRole.js isMaster.
export function isMasterProfile(data: unknown): boolean {
  if (!isPlainObject(data)) return false
  return data.master === true || (Array.isArray(data.role) && data.role.includes("master"))
}

const APP_NAME = "studio-admin"

function adminApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME)
  if (existing) return existing

  // Local QA: the same emulators the browser talks to (docs/studio-capture/README.md).
  const dev = process.env.NODE_ENV !== "production"
  const emulator = dev ? process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || undefined : undefined
  const storageEmulator = dev ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST || emulator : undefined
  if (storageEmulator) process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `${storageEmulator}:9199`
  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= `${emulator}:8080`
    return initializeApp({ projectId: "demo-studio", storageBucket: BUCKET }, APP_NAME)
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // A key pasted from the JSON file keeps its newlines as "\n"; .env.local
  // in double quotes turns them into real ones. Accept both.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  const missing = [!clientEmail && "FIREBASE_CLIENT_EMAIL", !privateKey && "FIREBASE_PRIVATE_KEY"].filter(Boolean)
  if (missing.length) throw new AdminConfigError(`${missing.join(" and ")} ${missing.length > 1 ? "aren't" : "isn't"} set on this server.`)
  let credential
  try {
    credential = cert({ projectId: PROJECT_ID, clientEmail, privateKey })
  } catch {
    // The key error would quote the value; keep it out of the logs.
    throw new AdminConfigError("FIREBASE_PRIVATE_KEY isn't a service account private key.")
  }
  return initializeApp({ credential, projectId: PROJECT_ID, storageBucket: BUCKET }, APP_NAME)
}

export type StudioAdmin = {
  bucket: StudioBucket
  /** Reads users/{uid} in the live database; throws when Firestore can't be reached. */
  isMaster: (uid: string) => Promise<boolean>
}

let admin: StudioAdmin | undefined

export function studioAdmin(): StudioAdmin {
  if (admin) return admin
  const app = adminApp()
  const db = getFirestore(app, FIRESTORE_DATABASE_ID)
  admin = {
    bucket: gcsBucket(getStorage(app).bucket(BUCKET)),
    isMaster: async (uid) => isMasterProfile((await db.doc(`users/${uid}`).get()).data()),
  }
  return admin
}
