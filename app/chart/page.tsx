import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

// Shareable link for the Top 50 chart: the landing page with the request
// dialog already open, plus its own preview card for LinkedIn and YouTube.
export const metadata: Metadata = {
  title: "Top 50 RCICs & Immigration Lawyers on YouTube | VisaFlo",
  description:
    "Licensed immigration professionals with the biggest YouTube audiences, ranked by subscribers and by views. Get both charts by email.",
  // Same content as the home page, so search engines should index only "/".
  alternates: { canonical: "/" },
  openGraph: {
    title: "Top 50 RCICs & Immigration Lawyers on YouTube",
    description:
      "Licensed only. Ranked by subscribers and by views on videos from the last 12 months.",
    images: [{ url: "/og-chart.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function ChartPage() {
  return <LandingPage chartOpen />;
}
