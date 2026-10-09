"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { MultiFactorResolver } from "firebase/auth"

import {
  authErrorCode,
  authErrorMessage,
  hasTotpFactor,
  resolveTotp,
  sendReset,
  signIn,
  signUp,
  useStudioUser,
} from "@/lib/studio/auth"
import { identify, track } from "@/lib/mixpanel"
import { AccountHeader, Display, ErrorText, Field, Page, PrimaryButton, QuietButton } from "@/components/studio/ui"

type Mode = "sign-in" | "sign-up" | "code" | "reset-sent"

const START = "/start"

export function SignIn() {
  const router = useRouter()
  const user = useStudioUser()
  const [mode, setMode] = useState<Mode>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in (this browser, or VisaFlo's session restored): go on.
  useEffect(() => {
    if (user && mode !== "code") router.replace(START)
  }, [user, mode, router])

  function finish(kind: "sign-in" | "sign-up") {
    identify(email.trim().toLowerCase())
    track(kind === "sign-up" ? "studio_sign_up" : "studio_sign_in")
    router.replace(START)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === "sign-up") {
        if (password.length < 8) throw Object.assign(new Error("weak"), { code: "auth/weak-password" })
        await signUp(email.trim(), password)
        finish("sign-up")
      } else if (mode === "code") {
        if (!resolver) return
        await resolveTotp(resolver, code.replace(/\s/g, ""))
        finish("sign-in")
      } else {
        const result = await signIn(email.trim(), password)
        if (result.status === "mfa-required") {
          if (!hasTotpFactor(result.resolver)) {
            setError(authErrorMessage({ code: "auth/no-totp-factor" }, "sign-in"))
            return
          }
          setResolver(result.resolver)
          setMode("code")
          return
        }
        finish("sign-in")
      }
    } catch (err) {
      if (mode === "sign-up" && authErrorCode(err) === "auth/email-already-in-use") setMode("sign-in")
      setError(authErrorMessage(err, mode === "code" ? "code" : mode === "sign-up" ? "sign-up" : "sign-in"))
    } finally {
      setBusy(false)
    }
  }

  async function onForgot() {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter your email above first, then choose Forgot password.")
      return
    }
    setBusy(true)
    try {
      await sendReset(email.trim())
      setMode("reset-sent")
    } catch (err) {
      setError(authErrorMessage(err, "reset"))
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  const title = { "sign-in": "Sign in to Studio", "sign-up": "Create your account", code: "Enter your code", "reset-sent": "Check your email" }[mode]

  return (
    <Page>
      <AccountHeader />
      <main className="mx-auto grid w-full max-w-[1120px] flex-grow grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] items-center gap-16 px-(--page-pad) py-12 sm:py-16">
        <div className="flex max-w-[400px] flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Display>{title}</Display>
            {mode === "sign-in" && (
              <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
                Use your VisaFlo email and password. Same account, nothing new to set up.
              </p>
            )}
            {mode === "sign-up" && (
              <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
                This also works as your VisaFlo login.
              </p>
            )}
            {mode === "code" && (
              <p className="m-0 text-[16px] leading-[1.5] text-stone-600">
                Open your authenticator app and enter the 6-digit code for VisaFlo.
              </p>
            )}
            {mode === "reset-sent" && (
              <p className="m-0 text-[18px] leading-[1.5] text-stone-600">
                We sent a reset link to <span className="font-medium text-stone-950">{email.trim()}</span>. Set a new
                password, then sign in here.
              </p>
            )}
          </div>

          {mode === "reset-sent" ? (
            <PrimaryButton type="button" className="self-start" onClick={() => switchMode("sign-in")}>
              Back to sign in
            </PrimaryButton>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              {mode === "code" ? (
                <Field
                  id="code"
                  label="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  required
                />
              ) : (
                <>
                  <Field
                    id="email"
                    label="Work email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@yourfirm.ca"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Field
                    id="password"
                    label="Password"
                    type="password"
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    placeholder={mode === "sign-up" ? "At least 8 characters" : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </>
              )}
              {error && <ErrorText>{error}</ErrorText>}
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? "One moment…" : mode === "sign-up" ? "Create account" : mode === "code" ? "Verify" : "Sign in"}
              </PrimaryButton>
              <div className="flex flex-wrap items-center justify-between gap-x-6 text-[14px] text-stone-600">
                {mode === "sign-in" && (
                  <>
                    <span>
                      New to VisaFlo?{" "}
                      <QuietButton type="button" className="inline-flex text-stone-950" onClick={() => switchMode("sign-up")}>
                        Create an account
                      </QuietButton>
                    </span>
                    <QuietButton type="button" onClick={onForgot} disabled={busy}>
                      Forgot password?
                    </QuietButton>
                  </>
                )}
                {mode === "sign-up" && (
                  <span>
                    Already use VisaFlo?{" "}
                    <QuietButton type="button" className="inline-flex text-stone-950" onClick={() => switchMode("sign-in")}>
                      Sign in
                    </QuietButton>
                  </span>
                )}
                {mode === "code" && (
                  <QuietButton type="button" onClick={() => switchMode("sign-in")}>
                    Use a different account
                  </QuietButton>
                )}
              </div>
            </form>
          )}

          <p className="m-0 text-[12px] leading-[1.5] text-stone-600">
            By continuing you agree to the{" "}
            <a href="https://vflo.app/terms" className="underline underline-offset-2">
              Terms
            </a>{" "}
            and{" "}
            <a href="https://vflo.app/privacy" className="underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        <figure className="m-0 hidden flex-col gap-3 justify-self-center md:flex">
          <video
            src="/samples/work-permit-study-selfie.mp4"
            poster="/samples/work-permit-study-selfie.jpg"
            autoPlay
            muted
            loop
            playsInline
            className="aspect-[9/16] w-[300px] max-w-full border border-stone-200 object-cover"
          />
          <figcaption className="flex max-w-[300px] flex-col gap-1">
            <span className="font-mono text-[12px] tracking-[0.1em] text-stone-600 uppercase">Sample</span>
            <span className="text-[14px] leading-[1.4]">Two checks before you study on a work permit</span>
          </figcaption>
        </figure>
      </main>
    </Page>
  )
}
