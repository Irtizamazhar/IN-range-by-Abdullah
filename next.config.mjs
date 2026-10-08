import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolate verification builds when a local development server is already running.
  distDir: process.env.JORO_NEXT_DIST_DIR || ".next",
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bcryptjs",
      "sharp",
      "winston",
    ],
  },
  /** Helmet-style defaults for Next.js (no Express). CSP omitted here — add nonces when vendor UI ships. */
  async headers() {
    const security = [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      security.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: security }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.fbcdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
        pathname: "/**",
      },
    ],
  },
  /** Applies to `npm run dev` (webpack). Not used with `npm run dev:turbo` (Turbopack). */
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Windows: avoid ENOENT on `.next/cache/webpack/.../*.pack.gz` renames and stale manifests
      config.cache = false;
      config.watchOptions = {
        ...config.watchOptions,
        poll: 2000,
        aggregateTimeout: 600,
      };
      if (!isServer) {
        // CSS updates can complete after a stylesheet was removed by another update.
        config.module.rules.push({
          test: /[\\/]next[\\/]dist[\\/]compiled[\\/]mini-css-extract-plugin[\\/]hmr[\\/]hotModuleReplacement\.js$/,
          use: [fileURLToPath(new URL("./scripts/webpack/css-hmr-cleanup-loader.cjs", import.meta.url))],
        });
      }
    }
    return config;
  },
};

export default nextConfig;
