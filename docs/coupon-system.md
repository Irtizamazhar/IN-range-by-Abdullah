# JORO coupon operations

## Audit and implementation report

Before this task the schema had `VendorCoupon` with a vendor, code, percent/fixed amount, minimum, total usage limit, expiry, active/inactive status and count, but there was no coupon redemption path or checkout control. The marketplace already had server-priced COD checkout with idempotency keys, vendor sale/commission splits, order cancellation and manual refund services. `VendorPromotion` is a homepage placement system and remains separate.

Changed files: `prisma/schema.prisma`, `prisma/migrations/20261014000000_coupon_system/migration.sql`, `lib/coupon-service.ts`, `lib/coupon-input.ts`, `lib/order-cancellation-service.ts`, `lib/refund-service.ts`, `lib/refund-math.ts`, `lib/prisma-order-includes.ts`, `lib/serialize.ts`, `lib/admin-permissions.ts`, `app/api/orders/route.ts`, `app/api/coupons/validate/route.ts`, `app/api/vendor/coupons/route.ts`, `app/api/admin/coupons/route.ts`, `app/api/admin/coupon-collections/route.ts`, `app/(user)/checkout/page.tsx`, `app/vendor/dashboard/marketing/coupons/page.tsx`, `app/admin/marketing/coupons/page.tsx`, `components/coupons/CouponDashboard.tsx`, `components/vendor/VendorSidebar.tsx`, `components/admin/Sidebar.tsx`, `tests/coupon-system.test.ts`, `package.json` and this document.

The customer checkout previews a server-calculated coupon and sends only its code to the order endpoint. Vendor controls cover owned products and categories, dates, discount caps, limits, pause/edit/deactivate, and campaign approval. Admin controls cover targeting, customer IDs, funding, budget, collections, activation, usage, net platform spending, repeat usage review and audit history. An admin campaign begins inactive and can be activated only by an authorized admin; every targeted vendor must approve the campaign regardless of funding. Existing COD payment flow remains in place.

Verification completed locally: Prisma schema validation and client generation passed; TypeScript `--noEmit` passed; focused ESLint passed; `npm test` passed 52/52 tests before two additional refund tests were added; `npm run build` passed before the final refund math helper extraction, with warnings in existing unrelated image and Edge dependency code. The final test rerun was denied by the execution approval gate, so the two new tests and final build have not been rerun. Database migration, live checkout integration, concurrent redemptions against MySQL, and Hostinger acceptance were not run because this workspace does not provide an isolated staging database and the live deployment was explicitly out of scope.

The coupon system extends the existing `vendorcoupon` table. The migration is additive and keeps legacy vendor coupons. New codes claim a unique `codeKey`; legacy duplicates remain untouched and an ambiguous code is rejected at checkout. New admin coupons use the same table with `ownerType = ADMIN` and no owning vendor. `couponredemption` stores one immutable snapshot per order. `couponcollection` defines reusable admin product groups; group membership is copied into a campaign when saved, so later collection edits do not silently change an approved campaign.

## Checkout and accounting

- A checkout accepts one `couponCode`. The validation endpoint is only a preview. `POST /api/orders` reloads products, validates eligibility, checks limits, allocates integer cents, and increments usage in the order transaction. The existing checkout idempotency key prevents a retry from redeeming again.
- Coupons apply to eligible product sale values only. Delivery, services and taxes are excluded. Products already sold below their `originalPrice` do not stack with a coupon. Negotiated Want quotes are excluded.
- Vendor-funded discounts reduce eligible `VendorOrder.saleAmount` before the existing commission percentage is calculated. `VendorShopOrder` and later earnings derive from those adjusted line amounts.
- Platform-funded discounts reduce the customer order total while vendor sale and commission stay based on the agreed product price. The redemption snapshot stores the platform funding separately.
- A whole unpaid order cancellation before fulfilment restores the redemption and budget exactly once. Paid cancellations, partial seller cancellations, partial refunds and full refunds retain the historical redemption. This avoids giving a used code back after payment, fulfilment or partial settlement. Refund caps use the customer's discounted eligible item price; a platform-funded refund reverses the protected vendor sale proportionately. Processed platform-funded refunds record a promotion reversal, and the admin dashboard shows gross, reversed and net spending. The campaign budget remains conservatively consumed after a refund.

Example with a Rs. 100 eligible item and 10% commission, excluding delivery: a Rs. 20 vendor-funded coupon makes the customer pay Rs. 80, commission Rs. 8 and vendor net Rs. 72. A Rs. 20 JORO-funded coupon makes the customer pay Rs. 80, commission Rs. 10 and vendor net Rs. 90; JORO records Rs. 20 promotional funding.

## Safe Hostinger deployment

1. Back up the production database and application files. Review the SQL in `prisma/migrations/20261014000000_coupon_system/migration.sql` against the actual production schema, especially the existing `vendorcoupon` table and its status enum.
2. Deploy the code and migration together in a maintenance window. Run `npx prisma migrate deploy` and `npx prisma generate` on the deployment host. Do not use `prisma db push` or a reset against production.
3. Restart the Next.js process and verify `/api/orders` still accepts a COD order without a coupon. Then create an inactive admin coupon and an owned vendor coupon in staging before exposing the feature.
4. Activate a small-budget admin campaign after recording any required vendor approvals. Watch `couponredemption`, `vendorcoupon.usedCount`, `vendorcoupon.spent`, order totals and vendor order amounts after the first redemption.

The migration has **not** been applied to a live database by this task. The in-memory validation rate limit is per server process; multiple Hostinger workers need a shared rate-limit store for a global limit.

## Manual acceptance

- Create vendor percent and fixed coupons, pause them, and attempt cross-vendor product targeting.
- Create a platform-funded admin campaign for a vendor product, verify it starts inactive and cannot activate until that vendor approves, then confirm vendor commission and net remain based on the undiscounted sale.
- Create a vendor-funded admin campaign, attempt activation before approval, approve in the vendor dashboard, then activate. Reject approval and confirm use stops.
- Check invalid, future, expired, minimum, total-use, per-customer, budget and wrong-product messages.
- Check a multi-vendor cart, an already discounted product, fixed discount larger than the eligible subtotal, and cart changes after applying a code.
- Submit the same checkout key twice and race the last available redemption from two sessions. Confirm only one count and one order per key.
- Cancel a complete undelivered order and confirm one restoration. Partially cancel a seller bundle and process partial and full refunds, checking the retained redemption and vendor ledger amounts.
