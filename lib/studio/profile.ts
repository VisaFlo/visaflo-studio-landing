"use client"

// Who is recording, as they typed it on /start. Nobody signs in there, so
// it lives in this browser only and is asked again on another device.
export type StudioProfile = { email: string; firstName: string; lastName: string; firm: string }

const KEY = "vf_studio_profile"

export const EMPTY_PROFILE: StudioProfile = { email: "", firstName: "", lastName: "", firm: "" }

export function loadProfile(): StudioProfile {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<keyof StudioProfile, unknown>>
    const field = (value: unknown) => (typeof value === "string" ? value : "")
    return { email: field(saved.email), firstName: field(saved.firstName), lastName: field(saved.lastName), firm: field(saved.firm) }
  } catch {
    return EMPTY_PROFILE
  }
}

export function saveProfile(profile: StudioProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {}
}

export function profileComplete(profile: StudioProfile): boolean {
  return Boolean(profile.email && profile.firstName && profile.lastName && profile.firm)
}

export function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}
