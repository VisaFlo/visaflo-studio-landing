"use client"

import * as React from "react"

import { trackStudioEvent } from "@/lib/analytics"
import { getAttribution } from "@/lib/attribution"
import { identify } from "@/lib/mixpanel"
import {
  EMAIL_PATTERN,
  INVALID_EMAIL_MESSAGE,
  type WaitlistSource,
} from "@/lib/waitlist"

const SERVER_ERROR_MESSAGE = "Something went wrong. Please try again."

type WaitlistContextValue = {
  email: string
  name: string
  firm: string
  submitted: boolean
  pending: boolean
  error: string
  setEmail: (value: string) => void
  setName: (value: string) => void
  setFirm: (value: string) => void
  submit: (source: WaitlistSource) => Promise<void>
}

const WaitlistContext = React.createContext<WaitlistContextValue | null>(null)

// The hero form and the full waitlist form share one signup: submitting either
// flips both to their success state.
function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmailValue] = React.useState("")
  const [name, setName] = React.useState("")
  const [firm, setFirm] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState("")

  const setEmail = (value: string) => {
    setEmailValue(value)
    setError("")
  }

  const submit = async (source: WaitlistSource) => {
    if (pending) return
    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(INVALID_EMAIL_MESSAGE)
      return
    }

    setError("")
    setPending(true)
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          name: name.trim() || undefined,
          firm: firm.trim() || undefined,
          source,
          attribution: getAttribution(),
        }),
      })
      if (response.status === 400) {
        setError(INVALID_EMAIL_MESSAGE)
        return
      }
      if (!response.ok) {
        setError(SERVER_ERROR_MESSAGE)
        return
      }
      setEmailValue(trimmedEmail)
      setSubmitted(true)
      identify(trimmedEmail, { name: name.trim() || undefined, firm: firm.trim() || undefined })
      trackStudioEvent("generate_lead", { lead_type: "sample_video", form_location: source })
    } catch {
      setError(SERVER_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <WaitlistContext.Provider
      value={{
        email,
        name,
        firm,
        submitted,
        pending,
        error,
        setEmail,
        setName,
        setFirm,
        submit,
      }}
    >
      {children}
    </WaitlistContext.Provider>
  )
}

function useWaitlist() {
  const context = React.useContext(WaitlistContext)
  if (!context) {
    throw new Error("useWaitlist must be used within a WaitlistProvider")
  }
  return context
}

export { WaitlistProvider, useWaitlist }
