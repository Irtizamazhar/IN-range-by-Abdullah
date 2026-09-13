# JORO marketplace implementation plan

## Existing architecture
Next.js 14 App Router, React 18, TypeScript, Prisma 6 and MySQL. Preserve customer/admin NextAuth, vendor sessions, local personal cart, POST /api/orders, VendorShopOrder, commissions, earnings, withdrawals and manual payment proof.

## Findings
- No current Wants, offer revisions, store follows, collaborative rooms, service bookings or vendor promotion models.
- Reviews currently permit guest submissions and enforce order/product uniqueness, not customer/product uniqueness.
- Homepage includes example demand and store rankings that must be replaced with real data and honest empty states.
- No package test script or tests directory found.
- Existing untracked .npm-cache-repair/ and public/logo1.png must be preserved.

## Implementation sequence
1. Add shared server authorization, safe additive schema and migrations, with a duplicate-review preflight that preserves existing data.
2. Implement public stores, idempotent follows, following and follower dashboards; unique verified purchase reviews and editing.
3. Implement moderated Wants, real interest ranking, vendor matching, immutable offers/counters and quote acceptance through existing checkout.
4. Implement authenticated family rooms, secure invitations, unique votes/comments and validated transfer to personal cart.
5. Implement reusable service offerings, coverage, checkout snapshots and independent booking lifecycle integrated with existing finance.
6. Implement store editing/slug redirects/QR, admin scheduled sponsored promotions, scoped notifications and post-purchase pages.
7. Connect navigation and homepage, remove fabricated metrics, gate unfinished optional modules, apply accessible responsive styles.
8. Run meaningful security/domain checks, TypeScript, lint and production build; record limitations and business decisions honestly.

## Database safety
Do not reset, seed fabricated data, delete historical rows, push schema with data loss, or apply migrations blindly. Generate and inspect migration SQL before deployment. Existing duplicates require an explicit preservation strategy before the new review constraint can be deployed.

## Verification
Follow idempotency/privacy; review ownership/eligibility/aggregation; promotion scheduling/vendor status; Want moderation/revision acceptance; family membership/votes/private checkout; service coverage/snapshots/commission/lifecycle; QR exports and redirects; responsive 360/390/768/1024/1440 layouts. No GitHub push.
