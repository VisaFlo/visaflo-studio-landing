"use client"

import { doc, getDoc } from "firebase/firestore"

import { studioDb } from "@/lib/studio/firebase"

export type StudioProfile = { name: string; firm: string }

const key = (uid: string) => `vf_studio_profile:${uid}`

function readSaved(uid: string): Partial<StudioProfile> {
  try {
    return JSON.parse(localStorage.getItem(key(uid)) ?? "{}") as Partial<StudioProfile>
  } catch {
    return {}
  }
}

export function saveProfile(uid: string, profile: StudioProfile) {
  try {
    localStorage.setItem(key(uid), JSON.stringify(profile))
  } catch {}
}

// Name and firm for the script and the request. What the person typed here
// wins; otherwise a VisaFlo customer's name comes from their own users/{uid}
// profile, which the Firestore rules let them read. The firm name lives on
// the company document, which browsers can't read, so it is asked once.
export async function loadProfile(uid: string): Promise<Partial<StudioProfile>> {
  const saved = readSaved(uid)
  if (saved.name && saved.firm) return saved
  try {
    const snap = await getDoc(doc(studioDb(), "users", uid))
    const data = snap.data() as { firstName?: string; lastName?: string } | undefined
    const name = [data?.firstName, data?.lastName].filter(Boolean).join(" ").trim()
    return { name: saved.name || name || undefined, firm: saved.firm }
  } catch {
    return saved
  }
}

export function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}
