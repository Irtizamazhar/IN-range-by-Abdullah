# Checkout incident — 17 October 2026

## Confirmed production root cause

The Hostinger logs supplied by the owner show `prisma.orderConfirmationEmail.upsert()` failing because `OrderConfirmationEmail.recipientKey` does not exist. The failing route is `POST /api/orders`. The upsert runs in the interactive order transaction through `queueOrderConfirmation`. Its exception aborts that transaction before confirmation is returned. The previous catch converted this schema failure into the generic HTTP 500 checkout message.

This is a mismatch between deployed application/Prisma code and database schema, not SMTP rejection, COD requiring online payment, address normalization, or the private-launch gate. The separate Google OAuth state-cookie errors in the supplied log do not explain this outbox upsert failure and were not changed.

The exact required existing migration is `20261016010000_vendor_order_notifications`, whose SQL adds the missing key and replaces the order-only unique index. The logs prove the column is missing, but do not establish whether the migration is pending, failed/partially applied, or marked applied despite schema drift. Production migration history must be checked before changing anything.

No production database connection, migration, manual table change, real order or payment was performed. The configured database inspected locally points to a local host; its read-only schema check failed, so it provides no further evidence about Hostinger.

## Local fixes prepared

These changes improve checkout safety but do not remove the production migration requirement:

- Wrap preflight and transaction errors in a consistent JSON error response with a generated `X-Request-ID`. Log only stage, Prisma code and sanitized model/table/column names rather than raw exceptions or submitted personal data. Database availability/schema failures use HTTP 503; stock and data conflicts retain friendly messages. Existing Prisma engine logging is unchanged.
- Require a nonempty order ID and order number before showing confirmation or clearing the cart. Empty/malformed HTTP 200 responses no longer count as successful orders. Server technical errors and non-JSON proxy responses do not appear as raw HTML/SQL to customers.
- Keep checkout idempotency keys in memory and session storage for the same customer/cart across network retries and reloads. Keep the synchronous submit lock. Clear the stored attempt only after a confirmed receipt. If browser storage is unavailable, in-memory retry protection remains; reload persistence then cannot be guaranteed.
- After a successful transaction, use its persisted order ID/number as a fallback receipt if the optional full receipt read fails. Existing admin SMTP and in-app vendor notification failures remain nonfatal after commit. This fallback never runs for rolled-back transactions.
- Submit and validate the existing separate-billing option. Preserve shipping/billing snapshots and postal details in the existing `OrderStatusEvent.details.addresses` JSON for the order-created event. Primary delivery fields remain on Order. No new columns or migrations are required; these snapshots are not a new billing/invoice UI.

COD still records `orderStatus=confirmed` and `paymentStatus=pending`. Checkout currently supports COD only; unsupported online methods remain rejected rather than falsely confirmed. Inventory checks, coupon calculation, fees, prices, vendor ownership, commissions and authentication were not weakened or recalculated differently. The notification outbox remains transactional; it is not bypassed to make checkout appear successful.

## Required Hostinger action — review only, not executed

Use the approved production deployment procedure and an operator with the correct environment:

1. Pause affected checkout writers/admin confirmation writes and email workers for a coordinated schema/client change. Take a verified production backup and review deployment/migration history.
2. Inspect the actual schema and migration state. These are read-only checks:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE migration_name IN (
  '20261015020000_order_confirmation_outbox',
  '20261016000000_order_handling_fee',
  '20261016010000_vendor_order_notifications'
);

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'OrderConfirmationEmail';

SHOW INDEX FROM OrderConfirmationEmail;
```

3. Run `npx prisma migrate status` in the production release environment as a read-only history check. Confirm the original outbox table/migration exists, inspect any partially applied migration, and review **all** pending migrations. Do not mark a migration applied merely to silence an error. If history claims the migration finished but the column is absent, stop for drift reconciliation through a separately reviewed migration plan.
4. If the vendor notification migration is genuinely pending and its prerequisites/schema match, the authorized operator can apply the reviewed migration set with the normal `npx prisma migrate deploy` workflow. This command applies all pending migrations, so it must not be run blindly. Do not execute standalone manual ALTER statements, reset, db push, or migrate dev against production.
5. The existing migration adds `recipientKey VARCHAR(191) NOT NULL DEFAULT 'customer'`, creates unique `(orderId, recipientKey)`, then drops the replaced order-only index. Existing customer jobs retain IDs/status/attempts and map to the customer recipient. Orders, customers and vendors are not deleted. DDL can lock tables; normal backup, operational review and maintenance coordination are still required. Do not rewrite historical migration files.
6. Verify the column/default and composite index, generate the matching Prisma Client/build, restart the matching application release and workers, and check sanitized server logs. Confirm a mocked/staging checkout first. A controlled real order/inbox check requires owner permission; do not create production test orders automatically. Reconcile My Orders before resubmitting any earlier uncertain checkout.

The minimal production repair is the reviewed schema migration. Deploying only these local UX/diagnostic changes will not repair the missing column.

## Email compatibility

The existing customer/vendor outbox, per-recipient uniqueness, payment eligibility, retries and uncertain-SMTP safeguards are unchanged. A missing outbox column still prevents order commitment, preserving transactional correctness. Actual SMTP rejection after commitment does not invalidate the saved order. No real test emails were sent.

Local configuration presence check: SMTP host/user/password/port are configured; values were not printed. `ORDER_EMAIL_CRON_SECRET` is absent locally. Production SMTP configuration, cron secret and scheduled authenticated worker calls must be checked separately. The cron secret is needed for automatic queue processing, not for creating the order/outbox transaction.

## Validation

- `npx prisma generate`: local client regenerated after unrelated committed service-commission schema changes; no database migration.
- `npx prisma validate`: passed.
- `npx tsc --noEmit`: passed after client regeneration.
- Checkout integration/unit fixtures: 10 passed. Covers correct COD totals/status, replay, both addresses, products/vendor separation, coupons, invalid/session/stock/payment cases, missing recipient key rollback, transaction failure, post-commit SMTP/read failures, invalid receipts and persistent keys.
- Existing vendor/order suite: 70 passed. Existing marketplace UX suite: 33 passed. Handling-fee/readiness suite: 5 passed. Total: 118 tests passed.
- `node scripts/test-checkout-browser.mjs`: passed at 320, 375 and 1280px with real checkout components and isolated session/cart/HTTP adapters. Covers session expiry, malformed/server/network responses, reload/retry keys, separate billing, double-submit lock, confirmation/tracking and one cart clear, with no horizontal overflow.
- Fixtures emulate database transactions; they are not a test against live MySQL or Hostinger. Browser checks do not send production requests or charges.
- `npm run build`: passed; existing unrelated image/Browserslist/Prisma deprecation warnings remain.
- `git diff --check`: passed.

## Exact files changed

- `app/(user)/checkout/page.tsx`
- `app/api/orders/route.ts`
- `lib/checkout-addresses.ts`
- `lib/checkout-diagnostics.ts`
- `lib/checkout-response.ts`
- `tests/checkout.test.ts`
- `scripts/test-checkout-browser.mjs`
- `docs/checkout-incident-2026-10-17.md`

No schema/migration history, `.env`, `er.email`, credentials, production data, colors, branding, profile logic, pricing rules or commission calculations were modified. No commit, pull, push or deployment was performed. Production checkout is **not claimed fixed** until the reviewed database repair and deployment are safely verified.
