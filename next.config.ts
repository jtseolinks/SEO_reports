import type { NextConfig } from "next";

// Security headers applied to every response.
// CSP allows 'unsafe-inline' for scripts/styles because the app and Next.js
// runtime rely on inline styles and the hydration bootstrap; frame-ancestors
// 'self' permits the same-origin PDF preview iframe while blocking clickjacking
// from other origins.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "@prisma/client", "prisma"],
  devIndicators: false,
  webpack(config, { isServer }) {
    if (isServer) {
      // Prevent webpack from trying to bundle Prisma runtime wasm/native modules
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        ({ request }: { request: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (
            request.startsWith("@prisma/client/runtime") ||
            request.startsWith("@prisma/adapter") ||
            request === "puppeteer-core" ||
            request === "@sparticuz/chromium"
          ) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
