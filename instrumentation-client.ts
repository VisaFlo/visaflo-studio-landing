import { initMixpanel } from "@/lib/mixpanel"
import { captureAttribution } from "@/lib/attribution"

// Runs once before hydration: record where the visitor came from, then start
// analytics. A failure here must never break the page.
try {
  initMixpanel(captureAttribution())
} catch (error) {
  console.error("Analytics setup failed", error)
}
