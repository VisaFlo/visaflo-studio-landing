import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Top 50 chart is emailed from assets/, so the file must ship with the
  // serverless function that reads it.
  outputFileTracingIncludes: {
    "/api/top50": ["./assets/**/*"],
  },
};

export default nextConfig;
