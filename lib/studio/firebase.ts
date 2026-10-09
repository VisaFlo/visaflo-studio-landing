"use client"

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore"
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage"

// Studio signs people in against the VisaFlo production Firebase project, so a
// VisaFlo account works here unchanged and a Studio account works in VisaFlo.
// These are the public web-app values (the same ones my.vflo.app ships).
export const FIREBASE_PROJECT_ID = "devdashboard-c9159"

const config = {
  apiKey: "AIzaSyAUeWHyep0uBj6NPMU9Av0Rn9uoM4Ohq5s",
  authDomain: "devdashboard-c9159.firebaseapp.com",
  projectId: FIREBASE_PROJECT_ID,
  // Canada-region bucket and database, the ones VisaFlo moved to in 2026-09.
  storageBucket: "devdashboard-c9159-ca",
  messagingSenderId: "1051689408312",
  appId: "1:1051689408312:web:e812d0a48a87ddd62593cd",
}
const FIRESTORE_DATABASE_ID = "ca-dryrun"

// Local QA only: point everything at the Firebase emulators (see
// docs/studio-capture/README.md). A demo- project id means a missed emulator
// hookup fails instead of touching production.
const EMULATOR_HOST = process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST : undefined

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let storage: FirebaseStorage | undefined

function firebaseApp(): FirebaseApp {
  app ??= getApps().length
    ? getApp()
    : initializeApp(EMULATOR_HOST ? { ...config, projectId: "demo-studio", apiKey: "demo-key" } : config)
  return app
}

export function studioAuth(): Auth {
  if (!auth) {
    auth = getAuth(firebaseApp())
    if (EMULATOR_HOST) connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true })
  }
  return auth
}

export function studioDb(): Firestore {
  if (!db) {
    db = getFirestore(firebaseApp(), FIRESTORE_DATABASE_ID)
    if (EMULATOR_HOST) connectFirestoreEmulator(db, EMULATOR_HOST, 8080)
  }
  return db
}

export function studioStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(firebaseApp())
    if (EMULATOR_HOST) connectStorageEmulator(storage, EMULATOR_HOST, 9199)
  }
  return storage
}
