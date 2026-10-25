# Service/gift checkout and saved-address release fixes

Updated 2026-10-25. **Final verdict: READY TO PUSH — local regression requirements passed.** Deployment remains subject to applying the committed migration and staging verification with real authentication/integrations. No commit, push, deployment, production migration, production settings change, real payment, refund transfer or real-order modification was performed.

## Root causes and resolutions

The original checkout assumed every accepted offer had a stock-backed catalog product. This broke standalone service requirements and bespoke gifts at acceptance, cart construction and order creation. Service quotes also inherited the physical-product COD-city gate. The preceding fixes introduced request-type-aware quote validation, server-derived agreed pricing and correct customer/provider binding. Default-address loading and saving were missing entirely: checkout read session contacts only, and the save checkbox was unused state. Those fixes have been preserved.

The prior pre-push review correctly returned NOT READY because order creation alone did not provide complete downstream fulfillment or return handling. Both failures were reproduced first as failing automated tests, then corrected:

1. **Service fulfillment:** the quote-only branch created a normal seller parcel order and no service booking. The physical seller workflow consequently required courier handover to complete the service. Checkout now transactionally creates a real `OrderService`, tied through its parent order to the accepted quote, Want, immutable revision, customer, approved provider, agreed quantity/price and service location. It creates no physical seller bundle, stock reservation or fake catalog reference for a service-only quote.
2. **Gift seller attribution:** productless gifts correctly consumed no stock, but returns inferred sellers only from inventory. Checkout now records a trusted item-to-vendor-order/bundle mapping in the existing committed `order_created` event. Non-stock returns/refunds resolve and cross-check that mapping against actual vendor orders. Missing, ambiguous or inconsistent attribution fails with an actionable administrative-review error before financial processing. No fake inventory rows were introduced.

These are source-backed and isolated-test reproductions. No production logs/database were inspected to attribute a particular historical customer failure.

## Service lifecycle after the fix

1. Customer posts a service Want; an approved provider sends an offer; the owner accepts the current valid revision.
2. Checkout verifies owner, provider, expiry, accepted status, city, quantity and agreed amounts. Order creation, quote claim, booking, initial service event, vendor notification and customer/provider confirmation jobs commit together.
3. The existing customer/provider/admin Services screens list the real booking and its agreed quantity, scope, warranty, completion estimate and location. Support ownership checks continue to use the actual booking ID.
4. The assigned provider uses the existing state sequence: `PENDING → CONFIRMED → SCHEDULED → IN_PROGRESS → COMPLETED`. Scheduling requests retain their existing future-date validation. Customers may request scheduling but cannot complete a service or assert receipt. Another provider cannot read/change the booking.
5. Authorized provider completion records service/order audit events. The parent uses the existing `delivered` fulfilled state, but no `shipped` status, pickup, tracking number or courier handover is required or manufactured. Service tracking uses a service-specific summary rather than a parcel timeline.
6. **Completion does not collect payment.** The existing order-management admin permission is required to record receipt separately. A standalone service receipt also requires evidence in Notes; the action is audited. Recording receipt before completion does not create an earning either.
7. Only a completed service with separately recorded `paymentStatus = received` can create the existing pending provider earning and its immutable credit ledger entry. Unique service-earning and ledger keys, transactional state guards and replay-safe upserts prevent duplicate settlement or resetting an existing earning. No payout/bank transfer is triggered here.
8. Whole-order cancellation closes the corresponding booking and prevents later completion. Administrator-reviewed service cancellation/failure retains `REVIEW_REQUIRED` handling; it does not invent an automatic refund or payment reversal. Existing support/dispute references remain valid.

Standalone quotes remain exclusive checkouts. Existing mixed product + service-add-on orders retain their real `ServiceOffering`/product references and their existing shipping, booking, completion and commission rules.

## Gift return/refund lifecycle after the fix

- Linked catalog gifts retain product ownership, availability, variant and stock validation. Bespoke gifts have nullable catalog references, actual vendor orders/bundles and an authoritative order-item mapping, without consuming stock.
- The return API first validates customer ownership. For non-stock items it resolves the exact committed seller line, verifies order/bundle/vendor identity and agreed line quantity/amount, and checks that seller bundle's delivery status.
- A safely unambiguous legacy single-item gift quote can use its persisted quote/vendor-order link when the newer event mapping is absent. Ambiguous historical data requires administrative reconciliation; it is not silently classified as platform liability.
- Returns persist the correct non-null seller, notify that seller, and appear through the existing seller-scoped return API. Another seller cannot list or approve them. Existing approval, rejection, transit and receipt states remain unchanged.
- Refund creation and processing independently validate seller attribution. A missing/mismatched liability reference produces HTTP 409 with a review message before processing.
- Customer refund limits/coupon rules and existing commission calculations remain intact. Non-stock gift seller recovery uses the existing proportional net-refund calculation, capped by the actual vendor line's net amount and earlier debits. The real earning link and audit/idempotency keys are retained. Restock requests do not invent stock for bespoke gifts.
- The isolated fixture of a PKR 1,800 gift with a configured 10% provider deduction produced a PKR 810 seller debit for a PKR 900 partial refund. Repeating the same simulated reference produced no duplicate debit. This was an isolated database record, **not a financial transfer**.

## Customer charges and product regression status

| Flow | Customer payable | Preserved rules |
| --- | --- | --- |
| Standard product | Existing catalog subtotal + configured `codCharges` - eligible discounts | COD cities, variants, stock, grouping, coupons, payment and delivery rules retained. Free delivery and configured charges below Rs. 50 remain unchanged. |
| Product + service add-on | Product amount + configured service amount × quantity + product delivery - eligible product discounts | Existing coverage checks and service commission ranges retained. Provider commissions are deducted from settlement, not added to the customer's bill. |
| Accepted service requirement | Accepted unit amount × agreed quantity + explicitly agreed quote charges | No automatic product delivery/COD charge. Existing negotiated-quote category/provider commission resolver retained. No new customer service percentage/fixed fee. |
| Accepted gift | Accepted unit amount × agreed quantity + agreed quote shipping | Correct owner/provider and agreed terms; inventory only when a real catalog product is linked. |

The frontend uses authoritative quote previews; the backend verifies displayed subtotal/delivery expectations and recalculates actual amounts. Stale amounts are rejected before committing an order. Existing quote claims and unique checkout keys prevent duplicate orders. Live fee settings were not inspected or altered.

## Saved-address persistence

The preceding authenticated profile/default-address integration remains intact. User edits are protected from late prefill responses; logout/account changes clear previous contact, delivery and billing state. Country remains Pakistan. The existing model stores apartment/area in the combined address and registered email in the customer profile.

Checked save runs after successful checkout and uses the owned order's persisted **delivery** address. The existing customer-address transaction lock serializes account writes; the existing default row is updated, and an order-specific saved event makes repeated saves idempotent. Unchecked checkout performs no address write. Independent billing is retained in the order event. Optional-save failure preserves order success, clearly warns the customer and pauses confirmation redirect.

**Actual MySQL persistence is now verified:** a newly created disposable database was migrated; real checkout/address handlers saved a default, then a fresh Prisma client reloaded it. Repeated save produced one default row. Customer B could neither read A's address nor save from A's order. Billing remained independent. Unchecked checkout preserved the saved address. The real checkout React UI autofilled through the MySQL-backed API bridge, saved a changed address after checkout, reloaded it on a fresh page and preserved it after a one-time unchecked address.

## Migration and deployment requirements

A minimal migration is now required; the earlier report's no-migration conclusion is superseded. `OrderService` previously required a catalog `ServiceOffering` and product string, so it could not honestly represent an accepted standalone requirement without fake references. The existing booking model was reused instead of adding another booking model.

Migration: `prisma/migrations/20261025000000_standalone_quote_service_booking/migration.sql`

```sql
ALTER TABLE `orderservice`
  MODIFY `serviceId` VARCHAR(191) NULL,
  MODIFY `productId` VARCHAR(191) NULL;
```

The Prisma relation to `ServiceOffering` is correspondingly optional. No table, existing row, unique settlement key, required catalog booking or foreign-key protection was removed. Product-linked bookings retain non-null references. The SQL was checked against Prisma's generated schema diff. All committed migrations were replayed into a disposable MySQL database, followed by an empty database-to-schema diff. The migration manifest was regenerated using the repository's manifest helper after that replay.

Before deployment, apply this migration through the approved repository migration workflow and regenerate/deploy the matching Prisma client/code. It was applied **only** to newly created disposable databases during this work, never to the configured application or production database. Historical service orders that were already created without a booking are not automatically rewritten; reconcile any such data if present before rollout.

## Verification results

| Check | Result |
| --- | --- |
| `npm.cmd test` | **192 passed, 0 failed**. Includes both initially failing blocker reproductions and new fulfillment/attribution regressions. |
| `npx.cmd tsc --noEmit --incremental false` | Passed. |
| Targeted Next.js lint | Passed without errors/warnings across all 39 changed code/test files. |
| `npx.cmd prisma validate` | Passed; pre-existing Prisma package-configuration deprecation notice only. |
| Prisma client generation | Passed locally. |
| `git diff --check` | Passed; normal LF/CRLF conversion notices only. |
| Existing checkout browser suite | Passed at 320/375/768/1280px; saved-address cases at 375/1280px; authoritative service/gift confirmation totals passed. HTTP/session/cart integrations in this suite are mocked. |
| `npm.cmd run test:checkout:db` | **11 groups passed** against newly created disposable local MySQL databases and real application handlers/helpers. |
| Real provider React UI | Reviewed actual agreed details, scheduled and completed its real test booking without a courier; payment stayed pending and earning count stayed zero. |
| Secret/configuration scan | No credential-pattern matches in added code/new files; `.env`, lockfile and production settings unchanged. Test identities/amounts are confined to isolated tests/scripts. |

The 11 database groups cover migration replay/schema equivalence; concurrent quote checkout/retry with exactly one order and booking; service authorization/scheduling/completion; explicit admin receipt evidence and single earning/ledger credit; product/mixed pricing and physical courier restrictions; bespoke gift return notification and simulated refund recovery; linked gift stock; multi-vendor isolation; whole-order booking cancellation; durable address/billing/customer isolation; and actual checkout/provider React UI operations against the database-backed route bridge.

Mandatory A–O coverage: service creation/completion/payment/idempotency (A–D), physical/mixed fulfillment (E–F), gift attribution/notification/refund/isolation (G–J), linked-gift stock and product/quote charges (K–M), saved addresses (N), and real database concurrent quote checkout (O) all passed. Existing pickup, cancellation, coupon, order-confirmation and security regressions also passed.

The suite creates a randomly named `joro_checkout_test_*` database via a local system connection, refuses non-local hosts, and removes **only** the database that it successfully created. All fixture records were removed with that database. The configured application database was not used for fixture reads/writes. Browser execution needed approved access outside the filesystem sandbox because esbuild could not resolve local dependencies inside it. An isolated adapter initially lacked the standard `URL` global; that test-harness issue was corrected and the complete suite rerun successfully.

## Complete changed-file inventory

The working tree contains 44 related paths, including the original uncommitted fixes. No unrelated functionality was reset or refactored.

| File | Purpose |
| --- | --- |
| `app/(user)/checkout/page.tsx` | Default-address prefill/edit protection, account reset, optional save and authoritative quote totals. |
| `app/(user)/checkout/OrderConfirmedModal.tsx` | Visible optional-address-save failure without losing checkout success. |
| `app/api/customer/addresses/route.ts` | Save the authenticated customer's committed delivery address. |
| `lib/checkout-address-preference.ts` | Account-scoped default update and per-order save deduplication. |
| `lib/checkout-response.ts` | Carry optional save warnings with a confirmed receipt. |
| `app/api/account/quotes/[id]/route.ts` | Owned quote title/type for nullable-product cart entries. |
| `app/api/checkout/handling-fee/route.ts` | Validate quote preview and return server-owned amounts. |
| `app/api/offers/[id]/route.ts` | Accept/snapshot valid service and bespoke-gift terms. |
| `app/api/vendor/offers/route.ts` | Allow service/bespoke offers and retain matching catalog gifts. |
| `app/vendor/dashboard/demand/[id]/page.tsx` | Remove the inappropriate no-catalog offer gate for service/gift requests. |
| `components/user/OfferCenter.tsx` | Construct quote cart entries without dereferencing a missing product. |
| `lib/offer-service.ts` | Request-type-aware product/provider validation. |
| `lib/offer-checkout-service.ts` | Owner/status/expiry/city/provider checks and commission override selection. |
| `app/api/orders/route.ts` | Transactional real service booking, quote claim, exact seller mapping, pricing and notification jobs. |
| `prisma/schema.prisma` | Nullable standalone booking catalog references. |
| `prisma/migrations/20261025000000_standalone_quote_service_booking/migration.sql` | Non-destructive nullable-column migration. |
| `prisma/migration-manifest.json` | Record the schema fingerprint and migration checksum. |
| `lib/service-quote-fulfillment.ts` | Authorized service transitions, independent payment gate and idempotent earning/ledger creation. |
| `app/api/services/bookings/route.ts` | List and advance standalone bookings through the existing service API. |
| `components/user/ServiceBookings.tsx` | Display agreed scope/location/quantity/payment and allow assigned-provider completion. |
| `lib/customer-service-policy.ts` | Expose safe agreed service details without internal commission amounts. |
| `app/api/orders/[id]/route.ts` | Protect standalone fulfillment from parcel status changes; audit evidenced receipt and safely settle completed services. |
| `lib/order-cancellation-service.ts` | Close standalone bookings during whole-order cancellation. |
| `lib/order-line-seller.ts` | Resolve exact non-stock seller liability from trusted persisted evidence. |
| `app/api/customer/returns/route.ts` | Preserve real gift seller and delivery slice; fail safely on unresolved liability. |
| `lib/refund-service.ts` | Revalidate liability and debit the correct seller's net amount once. |
| `app/api/admin/returns/[id]/route.ts` | Return actionable attribution-review errors to administrators. |
| `lib/prisma-order-includes.ts` | Include real service bookings in order reads. |
| `lib/serialize.ts` | Safe service order summary and service-specific tracking marker. |
| `app/api/customer/orders/[id]/route.ts` | Expose safe booking names/amounts in owned order details. |
| `app/(user)/account/orders/[id]/page.tsx` | Render service lines in customer history. |
| `app/(user)/invoice/[orderId]/page.tsx` | Render service invoice lines without double-counting. |
| `app/(user)/track-order/page.tsx` | Service-only status/scheduling view instead of parcel progress. |
| `lib/joro-email-templates.ts` | Correct service descriptions/totals and assigned-provider booking message. |
| `lib/order-confirmation-delivery.ts` | Deliver persisted service-provider confirmation jobs through the existing outbox. |
| `tests/checkout.test.ts` | Product/quote/add-on regressions and exact initial blocker reproductions. |
| `tests/checkout-offers-addresses.test.ts` | Offer acceptance, owner/provider checks, address ownership and persistence helpers. |
| `tests/checkout-release-safety.test.ts` | Completion/payment/earning idempotency and exact multi-vendor seller mapping. |
| `tests/handling-fee-preview.test.ts` | Updated quote-preview fixture. |
| `scripts/test-checkout-browser.mjs` | Existing mobile/desktop checkout, save/account-switch and quote-pricing browser regressions. |
| `scripts/test-checkout-release-db.ts` | Disposable MySQL migration, route, concurrency, billing, return/refund and lifecycle verification. |
| `scripts/test-checkout-db-browser.mjs` | Real checkout/provider UI against the isolated database-backed route bridge. |
| `package.json` | Include release safety tests and reproducible `test:checkout:db` command; no new dependency. |
| `docs/checkout-service-gift-address-fix.md` | Root causes, final evidence, changed-file reasons and deployment prerequisites. |

## Remaining limits and final verdict

**READY TO PUSH.** Both confirmed downstream defects are fixed and the requested local regression checks passed. No currently failing local check remains.

This is not a claim of live production checkout validation. Real authentication/cookie behavior, SMTP delivery, actual cash receipt/bank transfer, production migration execution and production data compatibility were not exercised. Staging/live verification remains a deployment prerequisite, as does the committed nullable-reference migration. Test receipt/refund records were isolated simulations with no financial transfer; no fake courier handover was created.

Existing administrator-reviewed service cancellation/refund policies remain review-based; no automatic service refund percentage, fee, fabricated payment or payout policy was introduced. Any historical booking-less service order or irreconcilable legacy gift seller must be reviewed rather than silently backfilled or charged to an unknown seller.
