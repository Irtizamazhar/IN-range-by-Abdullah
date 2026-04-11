<!-- markdownlint-disable MD060 -->

# Step 1 — Security & performance packages (Next.js 14)

This project uses **Next.js App Router** + **Route Handlers** (`app/api/*`), not Express. Packages below are chosen to work in that environment.

## Installed dependencies

| Package | Role |
| --- | --- |
| **zod** | Server-side request body / query validation (replaces `express-validator` for API routes). |
| **sanitize-html** | Strip/limit HTML to prevent stored XSS (`lib/security/sanitize.ts`). |
| **rate-limiter-flexible** | In-memory rate limits per IP / user key in Route Handlers (`lib/security/rate-limit.ts`). Swap to Redis/`@upstash/ratelimit` in production for multi-instance. |
| **sharp** | Image resize / WebP conversion for vendor uploads (use from Node runtime only). |
| **@tanstack/react-query** | Client caching & stale-while-revalidate for vendor/admin dashboards. Wired in `app/providers.tsx`. |
| **winston** | Structured server logs — no secrets (`lib/logger.ts`). |

**Dev:** `@types/sanitize-html` (TypeScript).

**Already present:** `bcryptjs`, `nodemailer`, `next-auth` (customer/admin), `framer-motion`.

**Not installed (Express-only or redundant on Next):**

- `helmet` → replaced by `headers()` in `next.config.mjs`.
- `express-rate-limit` → use `rate-limiter-flexible` in middleware / handlers.
- `xss-clean` / `compression` → use `sanitize-html`; compression is usually handled by the host / Next in production.

## Config changes

- **`next.config.mjs`**
  - Global security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, production **HSTS**.
  - `serverComponentsExternalPackages`: `sharp`, `winston` (avoid bundling issues).

## New utility files

- `lib/security/sanitize.ts` — `sanitizePlainText`, `sanitizeDescriptionHtml`
- `lib/security/rate-limit.ts` — factories + `consumeOrReject`
- `lib/logger.ts` — `serverLogger`

## Environment (for later steps)

Add when implementing vendor JWT (do not commit real values):

```env
LOG_LEVEL=info
VENDOR_JWT_SECRET=change-me
# Optional later: UPSTASH_REDIS_* for distributed rate limits
```

## Next step (Step 2 in your plan)

Prisma models for `vendors`, `vendor_documents`, … + seed `commission_settings` — **without altering existing tables** (only additive migrations).
