import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Top 50 chart is emailed from assets/, so the file must ship with the
  // serverless function that reads it.
  outputFileTracingIncludes: {
    "/api/top50": ["./assets/top50-*.png"],
    "/api/playbook": ["./assets/video-playbook.pdf", "./assets/video-playbook-research-kit.zip"],
    "/playbook/opengraph-image": ["./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
