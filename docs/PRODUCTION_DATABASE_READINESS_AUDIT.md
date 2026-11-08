# Production database readiness audit — 2026-11-08

**Verdict: NO-GO for production migration, backfill, push or deployment.** Local migration correctness is verified; current production readiness is not.

This audit executed **zero production SQL queries**. No production database write, migration/backfill, remote modification, commit, push, deployment, credential/profile edit, SSH-key registration or host-key acceptance occurred. No passwords, secret values or connection strings were printed. Application behavior and build settings were not changed.

## Verified evidence and access failure

| Item | Verified result |
| --- | --- |
| Approved private target | Existing live profile matches all fixed target/security settings; password is configured; AUTO_MIGRATE remains false. Values were not printed. |
| Normal live CLI validation | Fixed and rechecked: precisely CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are explicitly recognized as unrelated application configuration and excluded from database/tunnel configuration. credentials-check passes; unknown keys and changed fixed settings still fail. A before/after hash confirms the private profile is byte-for-byte unchanged. |
| Saved SSH tunnel | State file exists, but the recorded SSH process no longer exists. Ownership verification failed; no listener was reused or terminated. |
| Trusted noninteractive SSH authentication | Retried outside the sandbox with the existing known-host file, strict host checking and BatchMode. Server rejected authentication: `Permission denied (publickey,password)`. No remote command executed. |
| Actual production provider/version | **Unknown.** Schema/lock/config expect mysql; that does not prove the live engine/version. Local staging version is not production evidence. |
| Actual production connection | **Not established.** Configured database password was not tested because SSH authentication failed first. |
| Product/category totals, public counts, slug coverage/name collisions | **Unknown, not zero.** No production rows or aggregates were queried. |
| Current migration history/checksums/pending/drift/slug column | **Unknown.** Do not assume the slug migration is the only pending migration. |
| Historical receipt | A local status receipt dated 2026-10-27 records 30 applied history entries and no pending entries at that time. It predates later repository migrations and cannot establish current state. |
| Production backup | No backup was supplied or verified. No matching backup files were found in the limited local .joro-live/backups, backups and backup directories checked. This does not establish that Hostinger has no backups. |
| GitHub repository | Connected GitHub confirms Irtizamazhar/IN-range-by-Abdullah, default branch main. Current main's manifest contains nine active migrations and does not include the slug migration. Working-tree manifest contains ten and passes validation. |
| Hostinger live release/account | No authenticated hosting-management integration was available. Plugin discovery found Hostinger Mail only, which cannot inspect hosting/deployment. hPanel repository selection, deployed revision, runtime, auto-deploy, production flags and rollback artifacts are **unverified**. |

The normal live CLI additionally requires unchanged committed schema/manifest/migrations, including for status. This workspace intentionally contains uncommitted migration changes. No validator was bypassed and no commit was made merely to gain audit access. Once authentication is restored, read-only database-console inspection can be performed without weakening the deployment guard or committing/pushing this work.

GitHub sources inspected through the connected integration:

- https://github.com/Irtizamazhar/IN-range-by-Abdullah/blob/main/package.json
- https://github.com/Irtizamazhar/IN-range-by-Abdullah/blob/main/prisma/migration-manifest.json
- https://github.com/Irtizamazhar/IN-range-by-Abdullah/blob/main/scripts/lib/build-steps.mjs

These files prove repository behavior, not which revision/settings Hostinger currently runs.

## Important deployment-order finding

Normal `npm run build` runs Prisma generation and Next build without a database readiness check when JORO_DEPLOY_MIGRATIONS is false/unset. It does **not** enforce product.slug existence, unique-index presence or backfill coverage. The optional migration build path does not enforce backfill coverage either and must not be used for this release.

Therefore the statement “the new code can never deploy before schema/backfill readiness” is **not currently guaranteed by automation**. A successful build is not a production database readiness certificate. Prevent release-triggering pushes/deploys until the database checks pass, verify hPanel auto-deploy settings, and require an explicit deployment approval/read-only readiness gate. No such remote control was changed in this audit.

Repository-declared build/start commands are npm run build and npm start. The actual hPanel settings and real JORO_DEPLOY_MIGRATIONS value must be inspected privately; require false for the application rollout. Do not change auth, payment, checkout or analytics variables.

## Manual read-only evidence required

First restore SSH access using an already authorized registered key or native interactive authentication in the owner's terminal, or use the authenticated Hostinger database console. Verify the existing trusted host identity. The local profile's unrelated-field mismatch has been fixed without rewriting the profile or weakening fixed-target checks. Do not paste credentials into chat. No automatic key registration, profile rewrite or relaxed host verification is authorized by this audit.

The following are inspection-only SQL statements for an authorized operator, **not executed here**. Select the production database in the console first; verify its name privately against the approved configuration. Never return passwords, connection strings, customer records, raw product titles or SQL query text from other sessions.

```sql
SELECT VERSION() AS server_version, @@version_comment AS provider_comment;

SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM `_prisma_migrations` ORDER BY started_at, id;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND COLUMN_NAME = 'slug';

SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, SUB_PART
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

SELECT COUNT(*) AS total_products,
       COALESCE(SUM(isActive = 1), 0) AS active_products
FROM product;

SELECT COUNT(*) AS public_products
FROM product p
WHERE p.isActive = 1 AND (
  NOT EXISTS (SELECT 1 FROM vendorproduct vp WHERE vp.publishedProductId = p.id)
  OR EXISTS (
    SELECT 1 FROM vendorproduct vp JOIN vendor v ON v.id = vp.vendorId
    WHERE vp.publishedProductId = p.id AND vp.status = 'active' AND v.status = 'approved'
  )
);

SELECT COUNT(*) AS total_categories,
       COALESCE(SUM(isActive = 1), 0) AS active_categories
FROM category;

SELECT COUNT(*) AS eligible_categories
FROM category c WHERE c.isActive = 1 AND EXISTS (
  SELECT 1 FROM product p WHERE p.categoryRecordId = c.id AND p.isActive = 1 AND (
    NOT EXISTS (SELECT 1 FROM vendorproduct vp WHERE vp.publishedProductId = p.id)
    OR EXISTS (
      SELECT 1 FROM vendorproduct vp JOIN vendor v ON v.id = vp.vendorId
      WHERE vp.publishedProductId = p.id AND vp.status = 'active' AND v.status = 'approved'
    )
  )
);

SELECT COUNT(*) AS duplicate_name_groups,
       COALESCE(SUM(n - 1), 0) AS extra_rows_in_duplicate_name_groups
FROM (SELECT COUNT(*) AS n FROM product GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1) duplicates;

SELECT ENGINE, TABLE_ROWS AS estimated_rows, DATA_LENGTH, INDEX_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product';
```

Only if the slug column exists, also run:

```sql
SELECT COUNT(*) AS total_products,
       COALESCE(SUM(slug IS NULL OR slug = ''), 0) AS missing_slugs,
       COUNT(DISTINCT slug) AS distinct_nonnull_slugs
FROM product;

SELECT COUNT(*) AS duplicate_slug_groups
FROM (SELECT COUNT(*) AS n FROM product WHERE slug IS NOT NULL GROUP BY slug HAVING COUNT(*) > 1) duplicates;

SELECT COUNT(*) AS slug_id_conflicts
FROM product p JOIN product q ON p.slug = q.id WHERE p.id <> q.id;
```

Duplicate-name grouping is only an initial risk count. Different punctuation/Unicode titles can normalize to the same slug even when raw names differ. Run the existing planner as a **dry run** under an explicitly verified production connection after the nullable column exists, without its apply flags, and securely retain the ID-to-slug mapping. Do not print that mapping publicly. Coverage must include inactive products as well as public products.

Compare actual history with the verified manifest and documented archived-history allowlist using the existing checksum rules; do not rewrite/resolve history. A migration-history match alone does not prove no drift. Compare read-only column/index/foreign-key metadata with an expected schema reconstructed locally from exactly the applied migrations. If pending migrations include more than the slug addition, review and rehearse each one before approving any deployment tooling that applies all pending migrations.

## Backup, locking and rollback gates

In hPanel/backup storage, verify backup origin/database, timestamp, successful completion, scope (tables/data/history plus required triggers/routines/views and media references), checksum, retention and a tested restoration into an isolated target. No production restore is authorized. The twelve-product/72-table staging restore is verified but is not a production backup or a production-scale recovery test.

Actual product counts, engine/version, table/index size, transaction activity and lock privileges are unavailable, so migration duration and customer impact cannot be estimated responsibly. The unique index can require scanning the catalog; DDL can wait on metadata locks; backfill transactions can contend with inventory/order stock writers. Stage-specific timings are not a zero-downtime guarantee. Approve a measured lock/timeout budget and writer-quiescence plan for the actual catalog. Do not pause checkout/payments/orders as part of this audit.

After slug URLs are published, rollback must retain the slug mapping and a compatible resolver/redirect implementation. Confirm a specific immutable rollback artifact and its restart/build environment in hPanel. The previous ID-only application is not a safe rollback for indexed slug URLs. Keep additive database state; do not drop/reassign slug data to roll back application code. Test production-derived backup recovery separately before relying on it.

## Exact future execution order — approval gates, not execution authorization

0. Restore read-only access and complete every production check above. Privately verify hPanel deployed revision, repository/branch, build/start/runtime, migration flag, auto-deploy behavior and the rollback artifact. Freeze release-triggering pushes. The existing live migration tool requires an immutable committed payload; prepare/review a local-only migration commit or approved artifact under separate authorization before a future operation, without pushing. No commit was made now.
1. **Backup:** verify a fresh, consistent production backup and isolated restoration evidence; retain checksums and pre-change counts/identity snapshots.
2. **Migration:** under separate write approval, apply only reviewed pending changes from that immutable artifact. If slug/index already exist, verify definition/history rather than blindly applying duplicate DDL. Never reset, auto-resolve history or run build:deploy.
3. **Backfill:** within the approved writer window, generate/review the saved plan, then apply only after separate approval. Preserve IDs, names, pricing, inventory, vendors, images and relationships. Keep old-version product writers from creating new NULL-slug rows before cutover.
4. **Verification:** require valid nullable slug column/unique index, complete unique stable coverage for ALL products, no mapping conflicts/data loss, validated migration checksums, no unexplained drift, and real old-ID 308 -> canonical 200 plus missing/unpublished 404, metadata/JSON-LD/sitemap/robots checks. Keep the release blocked if any check fails.
5. **GitHub push:** only after the database verification gate and separate user authorization. Push exactly the reviewed release revision. If hPanel auto-deploy is enabled, this push is a deployment trigger and must be treated as such; verify control of that trigger beforehand.
6. **Hostinger deployment:** deploy the approved slug-aware application/writers with migrations disabled, verify the running revision and health, then resume product writers and recheck coverage/HTTP/SEO/customer smoke tests. The quiescence window extends through cutover and needs an approved impact budget.

No automatic schema/backfill deployment gate was added in this audit. Production write commands remain withheld while provider/history/backup/readiness are unverified.

## Exact next action and validation

**Next action:** an authorized operator must restore SSH authentication (or use the authenticated Hostinger database console) and collect the read-only production evidence above. Profile validation now passes. Do not push or deploy to test database readiness.

Validator-fix validation: all 14 live-safety tests passed. Both requested diagnostics passed; Cloudinary values stay outside the returned configuration and URL, unknown/duplicate keys are rejected, all fixed live settings remain strict, and initialization preserves the modern profile byte-for-byte. The managed SSH process is still absent, and the subsequent trusted noninteractive SSH check still fails with `Permission denied (publickey,password)`. No production SQL ran. The unchanged committed-payload requirement for live status/deployment remains in force.

This audit passed the local ten-migration manifest check, diagnostic script syntax checks and all eight build-workflow regression tests. It did not rerun or relabel the preceding 227-test/staging success as production evidence. Final verdict remains **NO-GO**.
