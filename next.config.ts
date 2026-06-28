import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Production config ──────────────────────────────────────────────────────
  // Suppress hydration warnings from browser extensions
  reactStrictMode: true,

  // Allow Supabase image domains if needed in future
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  // Env vars surfaced to both client and server
  // (NEXT_PUBLIC_* are already public; listed here for documentation)
  env: {
    NEXT_PUBLIC_ORG_NAME: process.env.NEXT_PUBLIC_ORG_NAME || "Namakkal District Co-operative Milk Producers' Union Ltd",
    NEXT_PUBLIC_ORG_SHORT: process.env.NEXT_PUBLIC_ORG_SHORT || 'NKL Dairy Union',
  },
};

export default nextConfig;
