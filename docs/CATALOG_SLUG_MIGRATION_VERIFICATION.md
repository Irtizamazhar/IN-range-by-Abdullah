# Product slug migration verification

Local migration blocker: **resolved**. Production deployment: **NO-GO pending production-specific evidence and release review**.

No production connection, read, write, migration, backfill, commit, push or deployment was performed in this task. All database writes targeted newly created, explicitly named local disposable databases on 127.0.0.1:3306. The normal empty joro_local database was not migrated or populated. Disposable databases remain available for inspection; none was destructively reset.

## Exact root cause

The inherited process environment had `RUST_LOG=warn` and `DEBUG=release`. Prisma CLI 6.19.2's native error decoder in node_modules/prisma/build/index.js splits stderr into lines and discards the first line before looking for a structured ERROR record.

When the schema engine probes a nonexistent disposable database:

- With `RUST_LOG=warn`, stderr contains only the structured ERROR P1003 (database does not exist) on its first line. Prisma discards that line, loses the code and throws an empty `Schema engine error`. Its normal missing-database creation branch is never reached.
- With `RUST_LOG=info`, the engine emits its startup INFO line first, followed by the same P1003 ERROR. Prisma discards the startup line, recognizes P1003, creates the disposable database and replays the migrations.

Both native stderr variants and CLI failure/success were reproduced. This was not a failed slug DDL statement, missing CREATE privilege, checksum mismatch or provider mismatch. Direct replay with INFO logging applied all ten migrations successfully. The generic message alone had hidden the cause.

## Fix through the verified workflow

`prismaCliEnvironment` in scripts/lib/migration-tools.mjs returns a copy of the subprocess environment with `RUST_LOG=info`. scripts/db-migrations.mjs uses it for Prisma CLI subprocesses only. The parent/app environment is unchanged, debug query logging is not enabled, and all existing safety/approval/schema-diff checks remain active. No node_modules files were edited.

An optional `--no-stage` flag skips only automatic Git staging. It does not skip validation, SQL review, migration execution or schema comparison. It was used to honor the local review workflow.

The following **local-only** verified workflow completed:

```text
node scripts/db-migrations.mjs check --full --update-manifest --no-stage
node scripts/db-migrations.mjs check
node scripts/db-migrations.mjs check --full --no-stage
```

The first command recorded prisma/migration-manifest.json only AFTER successful empty-database replay and an exact migration-to-schema comparison. The final two independently passed against the generated manifest. All nine previous migration checksums remain unchanged. The new migration SHA-256 is `47274066af6a9901a279fcc35c49807179e105820aa5f0bd44db1f717fc0033e`.

Regression coverage verifies quiet inherited logging is corrected without mutating the parent environment. The actual local replay proves the native CLI path succeeds under the inherited WARN setting.

## Provider and migration inspection

- Prisma schema datasource and migration_lock.toml both specify mysql.
- Repository history has 0_baseline plus nine incremental migrations, ending in 20261108000000_product_readable_slug.
- The local endpoint reports MySQL Community Server - GPL, version 26.7.0. This is local evidence only; no claim is made that production runs the same engine/version.
- Disposable pre-slug staging had the first nine migrations applied successfully. Only the tenth slug migration was pending; it applied successfully. Prisma migrate status then reported current history, and migrate diff reported no difference from schema.prisma.
- The slug migration only adds nullable product.slug VARCHAR(191) and a unique index. It changes no ID/title, drops no data and rewrites no relationship. NULLs allow existing rows to remain accessible before backfill. A populated uniqueness test confirmed collisions fail at the database level.

## Populated staging rehearsal

Reproducible runner: `node scripts/rehearse-catalog-slug-migration.mjs`. It refuses remote hosts, the production tunnel port and Hostinger-style database names, and writes only to fresh `joro_disposable_*` databases. It does not read .env.live.local. Run it only with an intentionally configured local development connection and an existing built Next application.

Successful run artifacts: `node_modules/.cache/catalog-slug-rehearsal/1794082047337_6666c554/`.

- Main database: joro_disposable_slugs_1794082047337_6666c554.
- Backup restoration database: joro_disposable_restore_1794082047337_6666c554.
- Seeded twelve synthetic products, including duplicate/punctuation/Unicode titles, two inactive products, out-of-stock inventory, variants, two approved vendors, vendor publications, twelve binary image rows, category references, a customer, saved product and order-item relationships.
- Created a complete logical fixture backup of all 72 base tables, DDL, rows and migration history before adding the slug column. No live data or credentials are in this fixture backup.
- Applied only the additive slug migration to the populated database. Compared every original table/row/cell afterward, excluding only the newly added slug column and expected new migration-history row. IDs, titles, prices, original prices, vendors, publication IDs, binary/URL images, stock, variants, category/order/saved relationships and timestamps were unchanged.
- Started an isolated built Next release using the real staging database. The existing product ID URL returned HTTP 200 while slugs were NULL, before backfill.
- Used the actual saved-plan CLI to generate and apply twelve assignments, including inactive products. Rejected a tampered plan with no assignments. After backfill all twelve slugs were nonempty and unique, and all original data cells still matched the backup.
- Forced a unique-index violation after an earlier write in a database transaction. P2002 was returned and the whole transaction rolled back; all data matched the pre-probe snapshot.
- Replanned/reapplied after completion: zero assignments, no mapping/data changes.
- Performed **54 real HTTP checks** against this populated database, including browser and Googlebot agents: every public old product ID returned a direct 308 to its correct slug, each canonical returned 200 with self-canonical HTML, inactive/missing products returned genuine 404, category/new-arrival redirects worked, and product sitemap/index/robots worked. Full database snapshots confirmed HTTP reads changed no database data.
- Restored the saved pre-migration backup into a SECOND new database, without resetting the migrated database. All 72 tables' data and original migration-history rows matched exactly, and the restored schema had no slug column.

Examples using synthetic staging records:

- `/products/stage-product-01` -> `/products/wireless-headphones`.
- `/products/stage-product-02` -> `/products/wireless-headphones-2` (same title, different preserved ID).
- `/categories/stage-category` -> `/categories/staging-audio`.

These are deliberately not represented as real production product mappings.

Backup file SHA-256: `614d38f5acf0589bc0eddb875ee6a7c9e6ae45f222ad3d96786b6bdba997542d`.
Restored all-table data fingerprint: `2f0943e1ed8874b8eb94c6f7fc974b72e80c70f19532190a8adcce94f29a0cff`.
The fixture backup is not a verified production backup; production triggers/routines, engine differences, scale and backup tooling were not exercised.

## Rollback and release sequence

Pre-publication restoration was rehearsed on a separate database, preserving the migrated database for comparison. The safe application rollback after publication must retain stored slug mappings, ID redirects and pre-stream status handling. The staged built release demonstrated this compatibility using retained migrated data. A different production rollback binary was not provided/tested; an ID-only binary remains unsafe after publishing slugs.

The production sequence remains: verify actual provider/version and migration history -> verify a restorable production backup and release artifacts -> approve additive DDL -> confirm column/index -> quiesce Product writers -> review/apply saved backfill plan -> verify all real rows -> deploy slug-aware application and writers -> resume catalog changes -> verify real HTTP/SEO/checkout behavior. New code must never query slug before the column exists. Avoid old writers creating NULL-slug rows between coverage validation and cutover. MySQL DDL/transaction lock behavior must be assessed at production scale.

## Results and remaining gates

- FULL `npm test`: **227/227 passed**, including the previously failing manifest validation and new logging regression.
- TypeScript: passed. ESLint: passed with existing image warnings.
- Production build: passed with migrations explicitly disabled. Additional focused URL/SEO/category tests: 25/25 passed.
- Verified manifest check and independent full replay/schema comparison: passed.
- Populated migration/backfill/restoration and 54 real database-backed HTTP checks: passed.
- Current root rendering guard still makes previously static pages dynamic; performance/cache implications remain a production review item from the preceding work.

Production provider/version, actual _prisma_migrations checksums/state, drift, inventory mapping, permissions, locks, production backup restoration and a production-compatible rollback artifact have NOT been confirmed because production was not accessed. The schema's mysql provider is not sufficient evidence of the live server or its history.

**Production database write commands are intentionally withheld** under the user's requirement to provide them only after actual provider/history confirmation and verified staging results. Staging is now verified; the production evidence gate is still missing. No production preflight, migration, backfill or deployment command was executed. Verdict: **GO for the local migration fix; NO-GO for production deployment until the remaining gates are satisfied.**
