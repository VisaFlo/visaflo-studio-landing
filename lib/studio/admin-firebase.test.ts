import { afterEach, describe, expect, it, vi } from "vitest"

import { AdminConfigError, isMasterProfile, studioAdmin } from "@/lib/studio/admin-firebase"

describe("isMasterProfile", () => {
  it("is true for the master flag, or the legacy 'master' role entry, as the VisaFlo backend reads it", () => {
    expect(isMasterProfile({ master: true })).toBe(true)
    expect(isMasterProfile({ master: true, role: "owner" })).toBe(true)
    expect(isMasterProfile({ role: ["master"] })).toBe(true)
  })
  it("is false for firm members and anything that isn't exactly that", () => {
    expect(isMasterProfile({ role: "owner" })).toBe(false)
    expect(isMasterProfile({ role: ["owner", "admin"] })).toBe(false)
    expect(isMasterProfile({ master: "true" })).toBe(false)
    expect(isMasterProfile({ master: 1 })).toBe(false)
    expect(isMasterProfile({ role: "master" })).toBe(false)
    expect(isMasterProfile(undefined)).toBe(false)
    expect(isMasterProfile(null)).toBe(false)
  })
})

describe("studioAdmin", () => {
  afterEach(() => vi.unstubAllEnvs())

  const production = () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_EMULATOR_HOST", "")
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST", "")
  }

  it("names each missing variable when the service account isn't configured", () => {
    production()
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "")
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "")
    expect(() => studioAdmin()).toThrow(AdminConfigError)
    expect(() => studioAdmin()).toThrow("FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY aren't set on this server.")
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "sa@devdashboard-c9159.iam.gserviceaccount.com")
    expect(() => studioAdmin()).toThrow("FIREBASE_PRIVATE_KEY isn't set on this server.")
  })

  it("refuses a private key that isn't one, without echoing it", () => {
    production()
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "sa@devdashboard-c9159.iam.gserviceaccount.com")
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "secret-not-a-key")
    expect(() => studioAdmin()).toThrow(AdminConfigError)
    expect(() => studioAdmin()).not.toThrow(/secret-not-a-key/)
  })
})
