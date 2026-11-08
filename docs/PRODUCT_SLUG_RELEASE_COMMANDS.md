# Prepared product-slug release — manual execution only

No production write or GitHub push was performed while preparing this release. The implementation is ready for a reviewed local commit, but production execution remains blocked until a fresh backup is restored successfully and release/rollback controls are verified.

## Remaining prerequisites

- Existing authorized SSH tunnel/authentication must be available in the owner's terminal.
- Install/provide a trusted MariaDB 11.8 `mariadb-dump` executable. The wrapper checks its version; none was found on the current PATH during preparation.
- Verify private backup storage permissions and sufficient disk space. The wrapper applies owner-only output-file permissions before writing any dump data.
- Restore the fresh production dump into a **dedicated isolated MariaDB 11.8.9 instance**, never production or the shared local application database. Verify readability, all required database objects, original data/relationships and counts. Record source, timestamp, checksum and restoration evidence. An export receipt alone has `isolatedRestorationVerified=false` and is not proof of restoration.
- Confirm a specific immutable slug-capable application rollback artifact in the actual Hostinger runtime. The previous ID-only application cannot safely serve published slug URLs. Keep the column, index and mapping on application rollback.
- Prevent automatic deployment until database verification completes. Hostinger auto-deployment is enabled, so the final push is the deployment trigger. Require `JORO_DEPLOY_MIGRATIONS=false` for application deployment; normal build success is not a live backfill-readiness gate.
- Arrange a separately approved Product-writer quiet window, including inventory writers. Keep it through backfill verification and cutover so old-version writers cannot create NULL-slug products. No checkout/payment/order behavior is modified to arrange that window.

## Exact command sequence

Read-only troubleshooting before a migration (no approvals or migration execution):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/db-live.ps1 -Action Preflight -OnlyMigration 20261108000000_product_readable_slug -BackupPath 'C:\Users\hamid\Pictures\JORO-DB-Backups\u749284283_inrange.20261108005306.sql.gz'
```

This verifies identity/history, the existing deployment preflight, the exact pending set and backup file/hash. It does not prove backup freshness, restoration, Hostinger rollback readiness or writer quiescence, and it returns before interactive approvals. Deployment still requires a native interactive terminal, backup-restoration attestation and exact APPLY approval. Closed approval input stops execution; it is reported as an input error rather than assumed to be a database-driver failure. Failure stages distinguish preflight, backup validation and each approval prompt. The historical unclassified-error receipt alone does not identify the underlying exception.

Run from the original project directory and keep the authorized SSH terminal open. These are commands for future approved execution; preparation did not execute them against production.

### 1. Tunnel and fresh backup

```powershell
npm.cmd run db:live:tunnel
$dumpBin = Read-Host 'Full path to trusted MariaDB 11.8 mariadb-dump.exe'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = ".joro-live/backups/product-slugs-$stamp.sql"
$plan = ".joro-live/product-slugs-$stamp.json"
node scripts/live-db-backup.mjs --dump-bin "$dumpBin" --output "$backup"
```

STOP on any failure. The exporter uses only the fixed live profile and the verified tunnel/identity/history. It ignores local DATABASE_URL, rejects non-InnoDB base tables for this consistent-snapshot method, uses a native single-transaction export with routines/events/triggers and hex blobs, and stores data in a new ignored owner-only file. The password is passed only in the native child's environment and is never printed or placed in argv. Raw native diagnostics are withheld. Keep schema/admin DDL changes out of the export window.

**STOP after export until isolated restoration is independently verified.** No repository command currently proves production backup origin/restoration automatically. Do not mark the receipt verified merely because the file is readable/nonempty. Keep the migrated production database intact during any future recovery rehearsal. Confirm the rollback artifact before proceeding.

### 2. Apply exactly the reviewed additive migration

```powershell
npm.cmd run db:live:deploy -- -OnlyMigration 20261108000000_product_readable_slug
```

Supply the verified backup path when prompted, independently attest production origin/restorability, then use the exact approval phrase displayed by the existing guarded workflow. The optional single-migration restriction refuses empty, different or multiple pending sets; it never expands the existing history/commit/backup approval rules. All execution uses immutable committed migration SQL. Never replace this with an unrestricted migrate deploy, db push/reset or generated drift SQL.

### 3. Generate, review and apply the private live plan

Only after migration verification and the approved writer pause:

```powershell
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/live-product-slugs.mjs plan --backup "$backup" --plan "$plan" --expected-products 13
```

Privately review every ID-to-slug assignment in the file. Do not paste its contents or secrets into logs/chat. It is ignored/untracked and owner-only. Planning requires the committed reviewed runner, fixed live target, matching migration history, nullable VARCHAR(191) column, full unique index, no unreviewed Product triggers, verified backup file/hash and exact reviewed product count. It never imports dotenv and never uses the inherited/local DATABASE_URL.

```powershell
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/live-product-slugs.mjs apply --backup "$backup" --plan "$plan" --expected-products 13 --confirm-catalog-writes-paused
```

The runner requires an interactive terminal and exact backup-restoration and backfill approval phrases. It rechecks the unchanged committed release, migration payload, backup hash and history. The serializable transaction rejects stale/modified plans, applies only slug with the original updatedAt, and verifies every product column except slug is unchanged before commit. It never changes IDs, names, price, stock, image URLs, category IDs or variants, and performs no relationship-model updates. Any verification failure rolls the whole transaction back.

### 4. Verify before allowing deployment

```powershell
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/live-product-slugs.mjs verify --backup "$backup" --plan "$plan" --expected-products 13
npm.cmd test
$env:JORO_DEPLOY_MIGRATIONS = 'false'
npm.cmd run build
node scripts/test-catalog-slug-http.mjs
node scripts/test-category-row-browser.mjs
```

The first command checks exact persisted mapping, coverage, uniqueness and full product-data fingerprints against the private plan. Tests/browser HTTP checks use isolated fixtures, not production. Before push, verify the live database/history and product invariants with the runner, and confirm release/rollback/environment settings in Hostinger. Do not mistake a fixture HTTP pass for verification of a deployment that has not occurred yet.

### 5. Manual push only after all gates pass

```powershell
git status --short
git diff --check
git log -1 --oneline
git push origin main
git status --short
```

Push only the reviewed local release commit. Audit-only/unrelated unstaged files are not included in the commit or push. Do not use git add -A, force-push or commit additional files casually. A non-fast-forward rejection requires review/retesting; do not override it. The push triggers Hostinger deployment, so do not run it merely to test readiness.

After Hostinger reports the expected revision healthy, verify real old-ID 308 -> slug 200, missing/unpublished 404, self-canonical/OG/Product/BreadcrumbList URLs and sitemap/robots. Resume only slug-aware Product writers after successful cutover and recheck coverage. No command in preparation deploys or pushes automatically.

## Safeguards retained

The existing production profile, identity checks, strict setting allowlist, archived/active migration checksums, committed migration guard, backup hash/attestation and exact interactive migration approval remain intact. The new live runner adds immutable execution-file checks, private commit-bound plans, explicit target binding, Product-trigger refusal and all-column product integrity verification. No secret/default URL or password is accepted as a CLI argument.

The committed package test command includes the new live-runner/backup/integrity and slug/category/SEO regression tests. The root pre-stream guard preserves genuine 308/404 statuses but makes formerly static routes dynamic; retain the previously identified Hostinger performance/cache review before production deployment.
