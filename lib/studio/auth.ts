"use client"

import { useEffect, useState } from "react"
import {
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type User,
} from "firebase/auth"

import { studioAuth } from "@/lib/studio/firebase"

export type SignInResult =
  | { status: "signed-in" }
  | { status: "mfa-required"; resolver: MultiFactorResolver }

// Same rules as my.vflo.app: email and password, plus the authenticator-app
// code for accounts that turned on two-step verification.
export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    await signInWithEmailAndPassword(studioAuth(), email, password)
    return { status: "signed-in" }
  } catch (error) {
    if (authErrorCode(error) === "auth/multi-factor-auth-required") {
      return {
        status: "mfa-required",
        resolver: getMultiFactorResolver(studioAuth(), error as MultiFactorError),
      }
    }
    throw error
  }
}

export function hasTotpFactor(resolver: MultiFactorResolver): boolean {
  return resolver.hints.some((hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID)
}

export async function resolveTotp(resolver: MultiFactorResolver, code: string): Promise<void> {
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)
  if (!hint) throw Object.assign(new Error("No authenticator app on this account"), { code: "auth/no-totp-factor" })
  await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code))
}

export async function signUp(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(studioAuth(), email, password)
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(studioAuth(), email)
}

export async function signOutOfStudio(): Promise<void> {
  await signOut(studioAuth())
}

export function authErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown"
}

// What to tell the person, by Firebase error code. Each message says what
// happened and what to do next.
export function authErrorMessage(error: unknown, mode: "sign-in" | "sign-up" | "code" | "reset"): string {
  switch (authErrorCode(error)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password doesn't match. Try again, or reset your password."
    case "auth/invalid-email":
    case "auth/missing-email":
      return "Enter a valid email address."
    case "auth/email-already-in-use":
      return "This email already has a VisaFlo account. Sign in with it instead."
    case "auth/weak-password":
      return "Use at least 8 characters for your password."
    case "auth/too-many-requests":
      return mode === "code"
        ? "Too many tries. Wait a few minutes, then enter a new code."
        : "Too many tries. Wait a few minutes, or reset your password."
    case "auth/invalid-verification-code":
      return "That code didn't work. Enter the current 6-digit code from your authenticator app."
    case "auth/no-totp-factor":
      return "This account uses a sign-in check Studio can't show yet. Sign in at my.vflo.app, or email info@vflo.app."
    case "auth/network-request-failed":
      return "No connection. Check your internet, then try again."
    case "auth/user-disabled":
      return "This account is turned off. Email info@vflo.app for help."
    default:
      return mode === "reset"
        ? "We couldn't send the reset email. Try again in a minute."
        : "Something went wrong on our side. Try again in a minute."
  }
}

// undefined while Firebase restores the session, then the user or null.
export function useStudioUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(studioAuth(), setUser), [])
  return user
}
