# Vendor onboarding and order confirmation fixes

## Root cause and remaining local setup

The onboarding client always sends multipart FormData. The API used `file instanceof File` while inspecting all three optional document entries, even when each entry was null. Node 18 supports Request.formData() but does not provide a global File constructor. On that runtime, the handler throws ReferenceError before it can parse or save the draft. The shared API wrapper turns this into the generic 503 “temporarily unavailable” response, and the client correctly refuses to advance. The handler now distinguishes string entries from uploaded files without referencing a global File. A regression test executes the real route with File absent and verifies successful Save & Continue.

This identifies the code failure on Node 18; the deployed Hostinger runtime/version was not inspected. Separately, a read-only check of this workspace's configured database returned `Database joro_local does not exist`. Local authenticated database flows cannot work until that database is restored/provisioned or DATABASE_URL is configured by the operator. No environment files or databases were changed. The initial node_modules also lacked the generated Prisma client/executable links and contained a truncated Next.js Windows compiler; those local dependency artifacts were repaired without changing package-lock.json.

## Onboarding behavior

- Save & Continue validates only the current step, both in the browser and the API. Later identity, shipping or bank requirements do not block the business step. Conditional Business and separate-return requirements remain enforced.
- Save Progress allows incomplete drafts and stays on the current step. Both actions wait for an explicit `{ ok: true }` response. A shared synchronous lock blocks duplicate/overlapping saves.
- Field errors, slug collisions and server failures remain visible while entered values and selected files remain in state. API responses can carry fieldErrors; the shared API helper preserves explicit NextResponse objects.
- The selected next step is saved in private onboardingData, which is merged with existing private details. Refresh uses saved progress. The genuine `Other` category now survives reload.
- File uploads finish before the next step is persisted. The save response includes document metadata, avoiding a second refresh request that could incorrectly make a successful save look like a failure.
- The interface has JORO teal styling, completed/current/upcoming steps, progress, accessible labels and error descriptions, address/description textareas, province suggestions and clear feedback. Save Progress stays left and Save & Continue stays right, including on mobile.
- The preview exit control uses normal document flow on onboarding, so it cannot float over form actions. Other pages retain its existing positioning.
- Final application validation, private-document checks, seller status checks, authentication, same-origin checks and email verification remain in place. Google OAuth code is unchanged.

## Authoritative order/email events

Current product checkout accepts COD only and persists the parent order as confirmed, with payment pending. The confirmation is queued inside that same order transaction. COD messages accurately say payment is due on delivery.

Legacy bank-transfer orders queue a confirmation only when the admin update transaction leaves the order confirmed (or further into fulfilment) **and** paymentStatus is received. Merely uploading proof, pending/submitted/failed/rejected payments and unconfirmed/cancelled orders cannot queue a confirmation. Repeated admin updates upsert the same unique order queue record without resetting its state. The previous direct admin-only confirmation sender was removed; other order notifications remain unchanged.

The worker rechecks eligibility and active account ownership before sending. It uses the persisted order owner's Customer.email, never checkout-supplied customerEmail. The current Customer model has no password-account email-verification flag; existing Google email verification rules remain unchanged. No new verification bypass was added.

The existing JORO email utilities and official `JORO <admin@joro.pk>` sender provide the logo, escaped customer/product/address content, order reference/date, quantities, unit and line prices, total in PKR, actual payment state and authenticated `/account/orders/{id}` link. SUPPORT_EMAIL appears only when explicitly configured. This is transactional mail with no marketing content.

## Persistent delivery and retries

OrderConfirmationEmail has a unique orderId, status, attempts, availableAt, claimedAt and acceptedAt. The queue write shares the successful order/payment transaction, avoiding a crash window between the order and its queue record. A worker invocation processes at most one message. Atomic conditional claims prevent concurrent workers from sending the same job. A stable SMTP Message-ID (`joro-order-confirmation-{jobId}@joro.pk`) aids provider-log reconciliation; SMTP itself does not guarantee deduplication by Message-ID.

- Only a recipient explicitly accepted by the SMTP provider produces status `accepted` and acceptedAt. This records provider acceptance, not a guarantee of inbox delivery.
- Definite non-acceptance, missing SMTP configuration and failures before SMTP retry with bounded exponential backoff, up to five attempts. Exhausted jobs become `failed`.
- Ambiguous DATA timeouts become `uncertain`. A job left `sending` for more than five minutes also becomes `uncertain` because the worker may have died after provider acceptance. These jobs never automatically resend.
- SMTP failure cannot reverse or falsely fail the successful checkout: no SMTP call runs in checkout. Queue/database failure does roll back the order transaction rather than creating an order without its durable queue record.
- SMTP and a database cannot provide an atomic exactly-once transaction. For an uncertain job, inspect provider logs using the Message-ID/reference before any manual status change. If the provider accepted it, record acceptance; requeue only after confirming non-delivery. Monitor failed/uncertain jobs and pending backlog.

No historic orders are automatically backfilled or bulk emailed.

## Hostinger deployment requirements (not performed)

1. Ensure the intended MySQL database exists and all existing repository migrations are reconciled. In particular, vendor onboarding needs the existing operational-onboarding migration and its onboardingData column. Do not point production at an empty local/test database.
2. Apply the additive `20261015020000_order_confirmation_outbox` migration through the normal reviewed production migration process **before** starting this application version. The order transactions now require the queue table. Migration SQL was created but was not applied anywhere.
3. Retain existing SMTP configuration: EMAIL_HOST/PORT/USER/PASS or SMTP_HOST/PORT/USER plus SMTP_PASSWORD or SMTP_PASS, and SMTP_SECURE as appropriate. The sender remains admin@joro.pk. Retain a valid HTTPS application origin (NEXT_PUBLIC_APP_URL or NEXTAUTH_URL) for order links and logos.
4. Add a high-entropy ORDER_EMAIL_CRON_SECRET to the application environment. No secret value is supplied in source. Optional SUPPORT_EMAIL is displayed only if the operator configures it.
5. Schedule an authenticated POST to `https://joro.pk/api/cron/order-confirmations` every minute with `Authorization: Bearer <ORDER_EMAIL_CRON_SECRET>`. Keep that credential in protected scheduler configuration. The endpoint requires bearer authentication even while private launch is enabled; GET is not permitted. Workers require no preview cookie.
6. Allow up to 60 seconds per request. SMTP connection/greeting/socket waits already have bounds. One worker per minute processes up to 60 messages/hour; increase invocation frequency or use overlapping authenticated invocations if volume requires it. Atomic claims support multiple workers. Alert on queue backlog as well as failed/uncertain states.
7. Keep private document storage persistent/writable under the existing deployment arrangement. Restart/rebuild normally after environment changes. Use a currently supported Node runtime for deployment; the multipart fix also removes the specific Node 18 File-global dependency.

## Verification

Final results: **61/61 focused tests passed**, browser checks passed at **360px and 1280px**, TypeScript passed, focused lint passed without warnings/errors, Prisma validation passed, and the final production build passed. The production build retains existing image, Browserslist and jose/Edge warnings. `git diff --check` passed. All results use the final implementation.

- `npm run test:vendor-order`: focused API, service, delivery, SMTP, phone/CNIC and private-launch tests. No database writes or real mail.
- `npm run test:vendor:browser`: actual form, schema and loading controls bundled into a local browser harness with mocked HTTP persistence; checks 360px and 1280px. Covers validation, Save Progress, failed/malformed responses, locks, advancing, reload persistence, Business fields, action positioning and overflow. Navigation and logo are fixture adapters. This does not establish real database persistence across login.
- `npx tsc --noEmit --incremental false`: TypeScript.
- Focused Next lint on all changed TypeScript files and the browser script.
- `npx prisma validate`: MySQL Prisma schema validation.
- `npm run build`: production build, including repository lint/type checks. Existing image, Browserslist and jose/Edge warnings are unrelated to these changes.

Real authenticated database/login persistence and real SMTP delivery remain unverified because the configured database does not exist and no real mail was sent. Browser persistence uses a mocked API; service and delivery tests use in-memory database substitutes. No commit, push, deployment, production migration or staging was performed. `.env`, `.env.local`, secrets and `er.email` were not modified or staged.

## Complete changed/new file list

Modified:

- app/api/orders/route.ts
- app/api/orders/[id]/route.ts
- app/api/vendor/onboarding/route.ts
- components/vendor/VendorOnboardingForm.tsx
- components/coming-soon-gate/PreviewExitControl.tsx
- lib/vendor-onboarding-schema.ts
- lib/vendor-onboarding.ts
- lib/marketplace-api.ts
- lib/order-emails.ts
- lib/mailer.ts
- lib/joro-email-templates.ts
- lib/private-launch/gate-policy.ts
- prisma/schema.prisma
- package.json

New:

- app/api/cron/order-confirmations/route.ts
- lib/order-confirmation-policy.ts
- lib/order-confirmation-delivery.ts
- prisma/migrations/20261015020000_order_confirmation_outbox/migration.sql
- tests/vendor-onboarding.test.ts
- tests/vendor-onboarding-api.test.ts
- tests/order-confirmation.test.ts
- tests/tsconfig.json
- scripts/test-vendor-onboarding-browser.mjs
- docs/vendor-onboarding-order-email-fixes.md
