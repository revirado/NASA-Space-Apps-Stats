import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTA: sin `output: 'standalone'` — así `next build` + `next start` funcionan
  // en local (sin bun) y el deploy en Vercel no necesita pasos extra.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
