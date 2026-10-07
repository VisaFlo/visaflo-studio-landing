import { track as trackMixpanel } from "@/lib/mixpanel"
import type { WaitlistSource } from "@/lib/waitlist"

type CtaLocation = "nav" | "hero" | "page"

type StudioEvents = {
  studio_cta_click: { cta_location: CtaLocation }
  studio_samples_click: { cta_location: CtaLocation }
  generate_lead:
    | { lead_type: "sample_video"; form_location: WaitlistSource }
    | { lead_type: "top50_chart" }
  // auto: opened by landing on /chart rather than by a click.
  top50_dialog_open: { auto: boolean }
}

type AnalyticsWindow = Window & { dataLayer?: IArguments[] }

// Keep the event payloads explicit so form values never reach analytics.
function trackStudioEvent<Event extends keyof StudioEvents>(
  eventName: Event,
  parameters: StudioEvents[Event],
) {
  if (typeof window === "undefined") return

  try {
    const analyticsWindow = window as AnalyticsWindow
    const dataLayer = (analyticsWindow.dataLayer ||= [])
    const queue: (
      command: "event",
      name: Event,
      values: StudioEvents[Event],
    ) => void = function () {
      // Use Google's arguments-shaped commands, including before gtag loads.
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments)
    }

    queue("event", eventName, parameters)
  } catch {
    // A blocked analytics script must never interrupt a sample request.
  }
  // Same event, same payload in Mixpanel, so both tools count the same things.
  trackMixpanel(eventName, parameters)
}

export { trackStudioEvent }
