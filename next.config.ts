import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Top 50 chart is emailed from assets/, so the file must ship with the
  // serverless function that reads it.
  outputFileTracingIncludes: {
    "/api/top50": ["./assets/top50-*.png"],
    "/api/playbook": ["./assets/video-playbook.pdf", "./assets/video-playbook-research-kit.zip"],
    "/playbook/opengraph-image": ["./assets/fonts/*.ttf"],
  },
  // Short links for the Instantly cold campaign, so emails don't show long
  // UTM URLs. Use them only in Instantly: every visit is credited to it.
  // Temporary (307) so the targets can change between campaigns.
  async redirects() {
    const instantly = "utm_source=instantly&utm_medium=email";
    return [
      {
        source: "/rank",
        destination: `/chart?${instantly}&utm_campaign=top50&utm_content=variant-a`,
        permanent: false,
      },
      {
        source: "/sample",
        destination: `/?${instantly}&utm_campaign=sample-video&utm_content=variant-b#waitlist`,
        permanent: false,
      },
      {
        source: "/examples",
        destination: `/?${instantly}&utm_campaign=studio-followup&utm_content=examples#samples`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
