# Customer and vendor order notifications

## Audit and changes

The application already queues customer confirmations inside the order transaction in `app/api/orders/route.ts` and the authoritative admin payment/status transaction in `app/api/orders/[id]/route.ts`. COD checkout creates a confirmed order with payment pending; bank-transfer confirmations require payment received. The existing `orderConfirmationEligible` policy, mail transport, branded template wrapper, cron endpoint and outbox worker are reused. Other existing admin, shipping, cancellation and payment-rejection notifications are preserved.

The existing `20261015020000_order_confirmation_outbox` migration provides atomic claims, recorded SMTP acceptance, bounded retries, and explicit uncertain outcomes. It supported one customer notification per order, not vendor notifications. The customer template lacked the requested subject, item images, charge breakdown and tracking button label. No second queue or notification system was introduced.

Customer emails now use `JORO | Order Confirmed - #[ORDER_NUMBER]`, Hello/customer greeting, persisted item names/images/quantities/unit prices/item amounts, subtotal, booked service amount when applicable, delivery charges, handling fee, coupon discount, final total, payment method/status and delivery address. Delivery charges reconcile persisted totals, the separately recorded handling fee, service prices and coupon redemption; mutable current shipping settings are never used. No estimated delivery date is invented. COD pending explicitly says due on delivery. The CTA is Track Your Order, linking to the existing authenticated `/account/orders/[id]` page. Closing: Thank you for choosing JORO; Jo Chahiye, Yahin Mile!; JORO Support.

Each vendor bundle receives `JORO | New Order Received - #[ORDER_NUMBER]` using its own immutable `VendorShopOrder.items` snapshot and gross bundle amount. Seller-funded discounted line amounts use the recorded subtotal; commissions and net earnings are not misrepresented as customer item prices. Images are included when available and safe. Payment method/status come from the authoritative parent order. Only the bundle's fulfillment name, phone and address are included; unrelated customer email, payment proof, account details, other vendors' products and checkout-wide total are excluded. View Order links to `/vendor/dashboard/orders/[bundleId]`.

The linked vendor API was also returning parent checkout items and totals. It now returns only the authenticated vendor's bundle items for labels and its own amount. Existing UI fallback uses that bundle amount. Customer and vendor API ownership checks remain in force and are tested.

Emails reuse JORO's inline styles, presentation tables, text alternative, official `https://joro.pk/logo.png`, tagline and `JORO <admin@joro.pk>` sender. Browser layout checks pass; no live Gmail/Outlook inbox testing was performed or claimed.

## Idempotency and retry behavior

- The existing table now has unique `(orderId, recipientKey)` jobs: `customer` or `vendor:[bundleId]`. Repeated confirmation events upsert without resetting accepted, failed, skipped or uncertain jobs.
- Enqueue and order writes remain in the same transaction. SMTP runs separately, so SMTP failure does not roll back or alter order/payment records.
- The existing protected POST `/api/cron/order-confirmations` processes one message per call. Concurrent workers claim atomically; stable Message-IDs persist across safe retries.
- Eligibility is rechecked before sending. Pending/cancelled/failed orders, failed/refunded payments, missing recipients, cancelled bundles, removed bundles, mismatched ownership and unapproved vendors do not send.
- Customer recipients use the active persisted account, never checkout-supplied email. Vendors use the persisted vendor account and order-scoped bundle lookup.
- Definite failures retry with the existing exponential backoff, at most five attempts. Stale sending claims and ambiguous SMTP failures become `uncertain`, requiring reconciliation before manual retry. This avoids blindly resending a potentially accepted message.
- `accepted` means SMTP accepted the recipient, not verified inbox delivery. SMTP cannot guarantee exactly-once inbox delivery. Permanent failures and skipped recipients require operator review; no automatic bulk historical backfill was added.

## Migration and activation — not performed

Prepared `prisma/migrations/20261016010000_vendor_order_notifications/migration.sql`. It adds a default customer recipient key, creates the composite unique index, then removes the old order-only unique index. Existing outbox rows and their acceptance/retry state are retained. No database migration or production database write was run. Prisma Client was regenerated locally and the schema validates.

Before production activation:

1. Review both the original outbox migration and this extension against production migration history. Use the normal backup and deployment procedure. Coordinate schema/client rollout with checkout/admin writers and workers; old code expects the old unique selector and must not keep running after the index change.
2. Apply the reviewed migration in the approved deployment window and deploy the matching generated client/application. No automatic deployment was performed here.
3. Configure a strong `ORDER_EMAIL_CRON_SECRET` in hosting configuration. It is missing from the local environment inspected during this task. `.env` was not modified.
4. Schedule authenticated POST requests to `https://joro.pk/api/cron/order-confirmations` with `Authorization: Bearer <ORDER_EMAIL_CRON_SECRET>`. Each call handles one recipient; size the call frequency/concurrency for customer plus vendor traffic and monitor oldest pending age. Do not expose the secret in URLs or public logs.
5. Verify canonical production origin is `https://joro.pk`, then monitor pending, accepted, uncertain, failed and skipped rows. Reconcile uncertain jobs against SMTP logs before requeueing; do not indiscriminately reset accepted jobs.
6. With owner permission, run a controlled staging/end-to-end order and inbox check, including multi-vendor separation. No real test emails were sent in this task.

## SMTP configuration

Existing variables are preserved: `EMAIL_HOST` / `SMTP_HOST`, `EMAIL_PORT` / `SMTP_PORT` (default 465), `EMAIL_USER` / `SMTP_USER`, and `EMAIL_PASS` / `SMTP_PASSWORD` / `SMTP_PASS`. Existing `SMTP_SECURE` handling is preserved. Sender remains the approved official address. A configured public origin is required for links. Host, user, password and valid port are present locally; only presence/validity was reported, never values. No SMTP credentials were changed, printed or embedded in source.

## Validation

- `npx tsc --noEmit`: passed.
- `npm run test:vendor-order`: 70 passed, using mocked SMTP and database adapters. Covers eligibility, customer/vendor rendering, multiple products, vendor separation, prices/discounts/charges, COD/bank states, repeated events, concurrent claims, missing recipients, safe retries, uncertain outcomes, API ownership and correct links.
- `npx tsx scripts/test-order-email-rendering.ts`: customer/vendor templates passed at 320, 375 and 768px, including long product names, no overflow, logo URL, accessible CTAs and correct authenticated route URLs. External image requests were blocked; no SMTP or database access.
- `npx prisma validate`: passed.
- `npm run build`: passed; existing unrelated image/Browserslist/Prisma deprecation warnings remain.
- `git diff --check`: passed.

Initial sandbox test runs hit Node's Windows user-lookup error; approved runs outside the sandbox passed. Production migration application, scheduler configuration, actual SMTP delivery and inbox rendering remain deployment verification steps.

## Exact files changed for this task

- `lib/order-confirmation-delivery.ts`
- `lib/joro-email-templates.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20261016010000_vendor_order_notifications/migration.sql`
- `app/api/orders/vendor/[id]/route.ts`
- `tests/order-confirmation.test.ts`
- `scripts/test-order-email-rendering.ts`
- `docs/order-notification-system.md`

Existing homepage, footer, About and Terms edits were preserved. No payment calculations, commission logic, authentication, onboarding, global colors, logos, secrets or production data were changed. No pull, commit, push or deployment was performed.
