# Catalog slugs: pre-deployment review

Verdict: **NO-GO for production**. The local Prisma replay/manifest blocker is now resolved; see [migration verification](CATALOG_SLUG_MIGRATION_VERIFICATION.md). Production was not modified. No production migration/backfill, commit, push or deployment was performed.

## Exact database change

`Product.slug String? @unique @db.VarChar(191)` maps to the existing `product` table. Migration `20261108000000_product_readable_slug` contains only:

```sql
ALTER TABLE product ADD COLUMN slug VARCHAR(191) NULL;
CREATE UNIQUE INDEX product_slug_key ON product(slug);
```

No tables, IDs, titles, relationships, prices, stock, seller fields or category slugs are replaced. NULL supports the transition while the old application continues to serve IDs. MySQL permits multiple NULLs in a unique index. Existing Category.slug already persists its canonical mapping; no category migration is required. There is no parent/child category relation in the current schema.

MySQL DDL is not an atomic two-statement transaction. Adding the column/index can take metadata locks. Rehearse lock duration, storage, privileges and failure recovery on a representative MySQL copy. If column creation succeeds but index creation fails, inspect actual schema and migration history before operator-led recovery; do not blindly rerun ALTER or mark an incomplete migration applied.

## Backfill safeguards

`scripts/catalog-slugs.ts` is read-only by default. It processes **all products**, including inactive and unpublished products, in createdAt/ID order. Existing valid slugs stay unchanged. New slugs normalize original titles, use deterministic numeric collision suffixes and reserve all existing product IDs as well as slugs (case-insensitively). Invalid existing mappings or ID/slug conflicts stop planning. No title or ID is edited.

A saved plan contains a database identity, catalog fingerprint and exact ID-to-slug assignments, without credentials. Apply requires that file, an exact host:port/database acknowledgement and confirmation that catalog writers are paused. A serializable transaction verifies the current fingerprint and recalculated assignments, checks each affected row count, preserves updatedAt, and validates full coverage, identity, titles, timestamps and slug uniqueness before commit. Stale/tampered plans, concurrent changes, collisions and incomplete coverage roll back. Files are created exclusively, so previous plans cannot be overwritten silently. Direct `--apply` is rejected.

The transaction can hold product locks and contend with inventory updates. Catalog-write quiescence includes background imports, vendor/admin edits and stock writers. Plan this operationally and measure it on staging; do not assume a long transaction is safe for a large catalog. Timeout/lock failure is a stop, not permission to weaken safeguards. No checkout/payment/order behavior was changed to arrange quiescence.

## Required rollout order — future approved operator actions only

1. The verified local replay, manifest regeneration and populated rehearsal now pass. Review the migration verification report and complete diff, including root rendering implications. Production provider/history confirmation is still required.
2. Obtain a restorable backup and a populated isolated staging copy. Record the pre-change product count, IDs/titles, URLs and migration history. Rehearse the exact schema expansion, backfill, HTTP tests and rollback with representative data and concurrency. Prepare a tested slug-capable rollback artifact before exposing new URLs.
3. Confirm the production target and permissions through an approved operator session. Run the repository's read-only deploy preflight and Prisma migrate status. Require a valid baseline, no failed/edited migrations or schema drift, and **only the reviewed slug migration pending**. Stop if unrelated migrations are pending. The current task has not performed these production checks.
4. Keep the existing application serving the storefront. Under separate approval, apply the reviewed additive migration. Production write commands are withheld until the actual provider/history is confirmed. The single-pending-migration gate is mandatory because deployment tooling can apply all pending migrations. Do not run build:deploy or enable migrations in a build.
5. Verify the column and unique index exist before running any new application process, preview server, cron or script that selects Product.slug. Generate Prisma Client for the maintenance tooling/new release. Leave old application code running until the backfill has passed.
6. In the approved quiet window, pause Product writers. Produce and save the dry-run plan (using the deliberately configured database connection):

The saved-plan procedure was tested by `node scripts/rehearse-catalog-slug-migration.mjs` against local disposable data. Exact production backfill commands remain withheld pending production provider/history verification.

Review and retain the plan securely; it contains internal catalog references. Require a nonzero count matching the expected production inventory; an empty database is not a valid rehearsal. Applying will require separate database-write approval and exact target identity acknowledgement. Any failure requires diagnosis/new review, not a blind retry or bypass.

7. Verify total product count and IDs/titles unchanged, zero NULL/empty slugs, zero duplicates and zero slug/ID conflicts. The backfill does these checks transactionally; independently retain SQL/audit results. Do not allow old-version writers to create products between final coverage validation and the new application cutover.
8. Build the reviewed release with `JORO_DEPLOY_MIGRATIONS=false` and `node scripts/build.mjs`. Deploy only after schema expansion and complete backfill, switch catalog writers to the new slug-creating code, then resume them. Recheck coverage after resuming. Pricing, stock, authentication, payments and order logic remain unchanged.
9. Verify browser and crawler requests against real records: old URLs respond 308 with a direct Location, target canonical responds 200, missing/unpublished records respond genuine 404, private query values are dropped, canonicals/OG/Product/Offer/BreadcrumbList agree, sitemap entries contain only canonical slugs, robots and sitemap index respond correctly. Check category pagination/filters, historical cart/order/review/room links and pasting a slug link into Shop Together. Perform approved staging authentication/checkout/payment smoke tests. Do not treat read-only fixtures as production validation.
10. Keep legacy ID routes indefinitely. Invalidate stale sitemap/application caches through the established deployment process; confirm old ID entries have disappeared. Monitor 404/308/5xx rates, latency, lock waits and Search Console after release. Ranking changes remain possible.

## Rollback

- Before new URLs are exposed: keep/revert to the old application, restore normal writers, and retain the additive column/index and assigned slugs. Existing ID URLs remain usable. A failed backfill transaction rolls back its assignments. Retain its plan and error for diagnosis.
- After slug URLs are exposed: roll back only to a **tested slug-capable compatibility release**, retaining slug lookup, ID redirects, pre-stream status handling and the persisted mapping. An old ID-only binary would 404 new canonical URLs and is not a safe rollback. If that artifact is not prepared, rollback readiness is a release blocker; use a reviewed forward fix instead.
- Do not clear/reassign slugs or drop the column after publication. The preferred database rollback is to leave additive state in place. No production schema-reversal command is supplied. Backup restoration was verified into a separate local database without resetting the migrated one; see the verification report.

## Application behavior and review implications

Homepage eligibility has no numeric five-item cap. Previously showOnHome excluded otherwise eligible categories. All active categories with public products now appear, home-selected categories first, with no fabricated/duplicated cards. A CSS flex-nowrap row preserves circular artwork and two-line names and scrolls natively. The public navigation menu now uses the same eligibility and stored slugs; admin category APIs retain their management behavior.

Product IDs remain in APIs, cart/order records and management routes. Current catalog sources emit stored-slug links. Historical cart/order snapshots resolve public paths through a read-only public product-links endpoint without changing their stored references. Review feed, shared rooms and legacy arrivals use canonical paths. Generic cards retain a deliberate ID fallback only for NULL-slug transition data; final backfill coverage is required before release. Deleted/unpublished historical items cannot acquire an invented canonical URL; unavailable navigation falls back to the listing.

Real HTTP testing exposed root Suspense flushing status 200 before page-level redirects. Middleware now overwrites a request-only catalog-route context, and the root layout validates detail records before streaming starts. It performs catalog reads only for matching detail routes. Existing auth/gate decisions are preserved and regression-tested. **Reading request headers in the root layout makes previously static application pages dynamic.** This rendering/cache/latency tradeoff and additional catalog lookups require production review/load testing; no cache/SEO settings were silently changed to disguise it. GA4, consent, login, payment and order code/settings were not edited.

Canonical category paths remain `/categories/<stored-slug>`; singular `/category/`, database IDs and numeric category legacy IDs redirect there. Existing numeric suffixes in stored category slugs remain stable. Filter URLs using category names remain functional.

## Evidence and unresolved blockers

- Configured database audit: product slug column absent, unique index absent, total products 0, eligible categories 0. This connection cannot verify production inventory, real old/new examples or coverage.
- Pure planner tests cover duplicate titles, punctuation, reserved IDs, existing mappings, deterministic suffixes, invalid mappings, fingerprint changes and idempotent replanning.
- Tests exercising actual page modules verify redirects, canonical rendering, unpublished/missing 404 decisions, metadata, Product/Offer/BreadcrumbList and category behavior.
- A built Next server with read-only fixtures was tested over real HTTP for browser and Googlebot user agents: product/category/new-arrival legacy 308, canonical 200, missing 404, canonical HTML, product/category sitemaps and robots. Fixture database writes are forbidden and zero were attempted. This is not a production data check.
- Actual category component browser fixtures pass 390/768/1024/1440/1920px: one row, no overlap or page overflow; fully visible counts 3/6/9/11/11. Other items scroll into view. These counts depend on container width and eligible inventory.
- TypeScript and ESLint pass (existing image warnings). Production build passes with migrations disabled. The final focused application/SEO/auth-gate/checkout/reviews/homepage suite passes **88/88** tests.
- Full npm test: **227/227 pass**, including verified manifest validation and the new native error-decoding regression. The repository workflow generated the manifest after successful replay/schema comparison.
- The earlier generic engine failure was traced to inherited RUST_LOG=warn plus Prisma 6 first-line stderr parsing. CLI-only INFO logging fixes the native P1003 protocol. Independent full replay/schema checks now pass; all old migration checksums are unchanged. See the verification report for populated staging and restoration evidence.
- Populated local staging passed: 12 synthetic products, all 72 tables preserved, complete pre-migration backup restored, 54 real database-backed HTTP checks. Unverified: actual production provider/version, privileges/history/drift, production mapping/coverage, production-scale locking/performance, production backup/rollback artifacts and live authentication/payment/checkout smoke tests. Until these gates pass, the production verdict remains NO-GO.

## Exact changed files

- app/(user)/cart/page.tsx
- app/(user)/categories/[slug]/page.tsx
- app/(user)/category/[slug]/page.tsx
- app/(user)/new-arrivals/[id]/NewArrivalDetailClient.tsx
- app/(user)/new-arrivals/[id]/page.tsx
- app/(user)/products/[id]/page.tsx
- app/(user)/together/[id]/page.tsx
- app/api/navigation-categories/route.ts
- app/api/product-links/route.ts
- app/api/products/route.ts
- app/api/together/[id]/route.ts
- app/layout.tsx
- components/SearchBar.tsx
- components/user/CategoryAutoScroll.tsx
- components/user/CategoryNavigation.tsx
- components/user/HomeProductCard.tsx
- components/user/ProductCard.tsx
- components/user/RateYourProductsSection.tsx
- docs/CATALOG_SLUG_MIGRATION_VERIFICATION.md
- docs/CATALOG_SLUG_ROLLOUT.md
- lib/allocate-product-slug.ts
- lib/catalog-product-select.ts
- lib/catalog-route-guard.ts
- lib/catalog-urls.ts
- lib/categories-store.ts
- lib/family-cart-service.ts
- lib/new-arrival-product-card.ts
- lib/new-arrivals-catalog.ts
- lib/product-slug-plan.ts
- lib/products-store.ts
- lib/public-reviews-list.ts
- lib/public-search.ts
- lib/seo.ts
- lib/seo-data.ts
- lib/seo-sitemap.ts
- lib/serialize.ts
- lib/sync-vendor-product-storefront.ts
- lib/use-product-links.ts
- middleware.ts
- prisma/migration-manifest.json
- prisma/migrations/20261108000000_product_readable_slug/migration.sql
- prisma/schema.prisma
- scripts/audit-catalog-urls.ts
- scripts/catalog-slugs.ts
- scripts/db-migrations.mjs
- scripts/fixtures/seo-prisma.cjs
- scripts/lib/migration-tools.mjs
- scripts/rehearse-catalog-slug-migration.mjs
- scripts/test-catalog-slug-http.mjs
- scripts/test-category-row-browser.mjs
- tests/catalog-slug-routes.test.mjs
- tests/catalog-urls.test.ts
- tests/home-category-navigation.test.ts
- tests/migration-workflow.test.ts
- tests/product-listing-fixes.test.ts
