import type { NextConfig } from "next";

// Next.js self-hosts fonts (next/font) and ships no inline analytics script,
// but its own hydration bootstrap script and Tailwind's injected <style> tags
// are inline — 'unsafe-inline' is kept for script-src/style-src rather than a
// nonce-based CSP, because a broken nonce wiring fails closed as a blank page
// in production and this session cannot render-test against a live deploy.
// Tightening this to a nonce-based policy is a recommended, separately
// verified follow-up (see docs/ARCHITECTURE_AUDIT.md).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Belt-and-suspenders alongside frame-ancestors for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ADMIN_ONLY: process.env.NEXT_PUBLIC_ADMIN_ONLY ?? "true",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
