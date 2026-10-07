import mixpanel from "mixpanel-browser"

import type { Attribution } from "@/lib/attribution"

// Mixpanel for the Studio landing (its own project, separate from the
// Dashboard's). Without NEXT_PUBLIC_MIXPANEL_TOKEN every call is a no-op, so
// local dev and preview builds send nothing.
const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN

// Requests go through /mp on our own domain (app/mp/[...path]/route.ts) so ad
// blockers don't drop them. Routes have no trailing slash because Next.js
// would redirect "/mp/track/" to "/mp/track"; the proxy adds it back.
const API_ROUTES = {
  track: "track",
  engage: "engage",
  groups: "groups",
  record: "record",
  flags: "flags",
  settings: "settings",
}

let enabled = false

export function initMixpanel(attribution: Attribution) {
  if (!TOKEN) return
  mixpanel.init(TOKEN, {
    api_host: `${window.location.origin}/mp`,
    api_routes: API_ROUTES,
    persistence: "localStorage",
    // Mixpanel reads utm_* from the URL itself and keeps the first touch as
    // initial_utm_* on the profile.
    track_pageview: "url-with-path",
  })
  mixpanel.register({ product: "studio" })
  // cid isn't a UTM tag, so Mixpanel ignores it; keep the first one seen on
  // every event so visits from customer emails can be broken down by company.
  const cid = attribution.last?.cid ?? attribution.first?.cid
  if (cid) mixpanel.register_once({ cid })
  enabled = true
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!enabled) return
  try {
    mixpanel.track(event, properties)
  } catch {}
}

// Ties this browser's anonymous visits to the email the person submitted.
export function identify(email: string, traits: { name?: string; firm?: string } = {}) {
  if (!enabled) return
  try {
    mixpanel.identify(email)
    mixpanel.people.set({
      $email: email,
      ...(traits.name ? { $name: traits.name } : {}),
      ...(traits.firm ? { firm: traits.firm } : {}),
    })
  } catch {}
}
