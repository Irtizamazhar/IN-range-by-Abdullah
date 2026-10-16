# GitHub readiness review — commit 35faeff

## Conflict resolution

Resolved both committed conflict blocks in `app/api/orders/vendor/[id]/route.ts`. The upstream version selected parent order items, total and handling fee, then computed parent subtotal/delivery charges. The stashed version removed these parent-wide fields to protect vendor isolation. The conflicted response already used the vendor bundle's own `labelItems`; the upstream parent calculations were unused.

The resolved route retains vendor session authorization, an order lookup scoped by both bundle ID and authenticated vendor ID, 404 for other vendors, the shared serializer/payment labels and bundle-only label items. It selects only the parent order number. Checkout handling fees, payment processing and notification enqueue/delivery are preserved. No parent-wide fee allocation is invented for a vendor bundle.

The committed handling fee also exposed an email integration gap: the customer receipt's residual delivery calculation included that fee. Email display now subtracts the persisted handling fee from delivery charges and lists it separately. Stored amounts, checkout calculations and commissions are unchanged. A focused regression covers discount + services + handling fee + delivery, and handling fee with free delivery.

## Omitted-file review

All nine previously untracked files belong to the intended work:

- About page and CSS: real `/about` route, original logo/tagline, equal Hamid Khan/Irtiza founder cards, existing seller/request/support actions and approved partnership email.
- AnnouncementBar CSS: resolves the committed module import, 32px strip/spacer and matching sticky navigation offset, with mobile condensation.
- Footer navigation definitions: resolve the committed Footer import, unique IDs, implemented destinations and explicit unavailable Grow/Privacy entries.
- Both original reports: implementation, footer/legal status, order-email operation and exact file lists.
- Vendor notification SQL: required by the already committed outbox schema and composite Prisma selector.
- Both browser scripts: exercise the real public-page components and email templates using controlled adapters; no real mail or production writes.

About/footer imports and CSS modules compile in the production build. Public-page checks passed at 320, 360, 375, 768 and 1280px. Email rendering checks passed at 320, 375 and 768px. These are component/template browser checks, not live production inbox or database checks.

## Migration safety

`20261016010000_vendor_order_notifications` depends on `20261015020000_order_confirmation_outbox` and the existing Order table. Its three statements add `recipientKey` defaulting to `customer`, create unique `(orderId, recipientKey)`, then drop the superseded order-only unique index.

Existing jobs keep IDs, statuses, attempt counts and acceptance timestamps. Existing uniqueness ensures the new default customer keys do not collide. The replacement index starts with `orderId` and is created before the old index is dropped, retaining foreign-key index coverage. Customer/vendor/order tables and records are not updated or deleted. No table/column drops, truncation or data deletes are included. Existing migration history and the committed Prisma schema were not modified.

Prisma validation and a database-free schema diff confirm the intended column/default/index change. The generated diff reaches the same schema by dropping/recreating the foreign key; the reviewed SQL retains that constraint by creating the replacement index first. No database connection, migration execution or production migration-history inspection was performed. Actual production application remains subject to migration-history review and normal DDL/deployment coordination, as documented in `order-notification-system.md`.

## Validation

- Project conflict-marker scans: no remaining markers in tracked/untracked source. New regression scans source/config/SQL/docs before future commits.
- `npx prisma validate`: passed.
- `npx tsc --noEmit`: passed after regenerating the stale local Prisma client.
- `npm run test:vendor-order`: 70 passed.
- `npm run test:marketplace:ux`: 33 passed.
- `npx tsx --tsconfig tests/tsconfig.json --test tests/repository-readiness.test.ts tests/handling-fee.test.ts`: 5 passed.
- `node scripts/test-public-pages-browser.mjs`: all five widths passed.
- `npx tsx scripts/test-order-email-rendering.ts`: all three widths passed.
- `npm run build`: passed, including `/about`. Existing unrelated image, Browserslist, Prisma configuration and jose Edge warnings remain.
- `git diff --check`: passed.

Sandbox user lookup/esbuild access and the Google Font download initially failed. Approved checks outside the sandbox passed without changing branding or font configuration.

## Exact files to stage

The three tracked fixes and eleven new files below form the remaining change set. They were not staged, committed or pushed automatically.

```text
app/api/orders/vendor/[id]/route.ts
lib/joro-email-templates.ts
tests/order-confirmation.test.ts
tests/repository-readiness.test.ts
app/(user)/about/page.tsx
app/(user)/about/page.module.css
components/user/AnnouncementBar.module.css
lib/footer-navigation.ts
prisma/migrations/20261016010000_vendor_order_notifications/migration.sql
scripts/test-order-email-rendering.ts
scripts/test-public-pages-browser.mjs
docs/order-notification-system.md
docs/public-pages-review.md
docs/github-readiness-review.md
```

Previously committed homepage/footer/order/schema changes do not need to be staged again. Review these paths explicitly rather than staging unrelated files.

## Remaining activation and content items

No source/build blocker remains. Production email activation still requires approved migration application, a configured `ORDER_EMAIL_CRON_SECRET`, scheduled authenticated worker calls and a permissioned delivery/inbox check. The prior local configuration check found the cron secret missing; no secret files were opened or changed in this repair task. Approved Terms DOCX and Privacy Policy content remain pending from the earlier public-page work.

No production database, credentials, `.env`, `er.email`, global colors, branding, logo or unrelated workflows were changed. No pull, commit, push or deployment was performed.
