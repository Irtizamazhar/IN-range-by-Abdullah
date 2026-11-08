# Final pre-migration safety check — 2026-11-08

**Verdict: NO-GO for production migration/backfill/deployment.** The proposed DDL and thirteen-product allocation pass inspection. A recent restorable production backup and release/rollback readiness remain unverified.

Only SELECT metadata/data reads and Prisma's explicitly read-only migrate diff comparison ran. No production data/schema/history was modified. No migration, backfill, commit, push, deployment or environment/profile change occurred. Product IDs, names and proposed URLs were processed in memory and not printed; no credentials or connection strings were printed.

## Production findings

The clean committed worktree and original authorized SSH tunnel were verified again. Baseline, documented archived history, checksums and ordering passed the existing safety functions.

- Server: **MariaDB 11.8.9-MariaDB-log**.
- Product table: InnoDB, Dynamic row format, utf8mb4_unicode_ci.
- Product data/index allocation reported by metadata: 49,152 bytes each (allocation metadata, not a duration estimate).
- All nine committed active migrations are applied. The validated local proposal adds **only 20261108000000_product_readable_slug**; no unrelated pending migration was identified.
- product.slug and its index are absent.
- The existing product category foreign key and incoming image, vendor publication, order item, inventory, review, room, saved-product, service, offer and warranty references were inventoried without alteration.
- Pending product metadata-lock information was unavailable to the audit user. Future lock waits and execution duration cannot be certified from the small catalog size alone.
- The protected profile was byte-for-byte unchanged. Original pending-file fingerprints remain 61/61 unchanged and the clean audit worktree remains clean.

Latest sanitized artifacts: `.release-prep/pre-migration-safety/1794158760651/report.json`. The first comparison is retained under `.release-prep/pre-migration-safety/1794158451159/`.

## Backup verification — NOT SATISFIED

No production backup file or hPanel backup completion/restore evidence was supplied. No candidate files were found in the checked local .joro-live/backups, backups or backup directories. This is not a claim that no backup exists in Hostinger or elsewhere.

The earlier local twelve-product/72-table fixture backup/restoration is not a recent production backup. No production-derived backup restoration was run in this task. The repository's verifiedBackup helper checks only file existence, nonzero size and SHA-256; its production origin, recency, scope and actual restoration must be verified independently. The live deploy tool requires explicit operator backup attestation but does not itself prove restoration.

Required evidence: a fresh full production backup with source/time/completion/checksum, all necessary tables/data/history and database objects/media dependencies, followed by a restore into an isolated MariaDB 11.8.9 target and comparison of table counts/relationships/schema. Never test restoration by overwriting production. No backup creation or restoration command was invented or run here; no native MariaDB dump client was found on the terminal PATH and hPanel backup access was not available through the connected tools.

## MariaDB migration compatibility — INSPECTION PASSED

The exact reviewed SQL contains two statements: adding nullable product.slug VARCHAR(191), then a unique product_slug_key index on that column. SHA-256 is `47274066af6a9901a279fcc35c49807179e105820aa5f0bd44db1f717fc0033e`.

No UPDATE/DELETE, existing-column change, relationship change, table drop or unrelated schema operation appears in this migration. Existing rows receive NULL until backfill. MariaDB supports these ADD COLUMN/unique-index operations and multiple NULL values in a unique index. This means creating the index before the backfill does not require inventing different values for the existing NULL rows.

Official sources checked:

- [MariaDB ALTER TABLE](https://mariadb.com/docs/server/reference/sql-statements/data-definition/alter/alter-table)
- [MariaDB NULL values and unique indexes](https://mariadb.com/docs/server/reference/data-types/null-values)
- [InnoDB online DDL overview](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-online-ddl/innodb-online-ddl-overview)

This is syntax/metadata compatibility verification, not an executed DDL test against production or a new MariaDB-11.8.9-matched staging rehearsal. DDL can take metadata locks and the two statements are not one rollbackable data transaction. Do not promise zero downtime; confirm lock monitoring/timeout/recovery handling for the approved window.

## Schema drift — DOCUMENTED DIFFERENCES ONLY

The raw comparison against the committed pre-slug datamodel exits 2. It is NOT an empty diff. Each operation was classified against live index/foreign-key metadata and the repository's documented Accepted differences in DATABASE_MIGRATIONS.md:

- Preserved extra legacy tables: wantpost and wantofferlegacy20260914.
- 104 foreign-key name pairs differ only in capitalization; child/parent columns and UPDATE/DELETE actions match.
- 131 index-name pairs differ only in capitalization; uniqueness, ordered columns, prefix lengths and sort directions match.
- **No unexpected Prisma-modeled operation remained.** No modeled product column/type/default change was identified against the pre-slug baseline.

These are already accepted historical differences, not a request to normalize production. Preserve them. The generated difference file is labeled `READ_ONLY_DIFFERENCES_DO_NOT_APPLY.sql`; it includes destructive legacy-table drops/name rebuilds and must NEVER be executed. The additive slug migration does not contain these operations.

Scope: Prisma-modeled tables/columns/indexes/relationships. This does not certify all routine, trigger, view or runtime/application behavior. A history checksum match alone was not used as proof of no drift.

## Backfill preview — ALL 13 PRODUCTS SUPPORTED

The actual prepared pure planner processed all thirteen production ID/name/timestamp records in memory, using NULL for the not-yet-created slug field:

- 13 inputs -> 13 assignments -> 13 unique, lowercase URL-safe slugs.
- Every proposed slug meets the 191-character limit and reserves existing product-ID names.
- Input fingerprint was unchanged after planning; product names/IDs were not edited.
- Mapping SHA-256: `272eada33726c359d15bc25844f66f17e97345cce19e20a39c111450d099e13c`.
- Production updates: **0**.

The actual saved apply plan must be generated AFTER separately approved schema expansion; this in-memory pre-column preview is deliberately not an apply-ready plan. Source review confirms the apply script updates only slug and explicitly retains the original updatedAt, verifies input/final identities and names, and checks complete coverage transactionally. Prices, stock, images, vendors, order references and relationships are not update targets. Actual post-backfill production verification is still a future gate; the previous populated staging test verified full original data preservation.

## Repository-supported commands and current blockers

### Safe inspection commands available now

From the original workspace:

```powershell
node scripts/check-live-baseline.mjs
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/check-live-slug-safety.mjs
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/catalog-drift-classification.test.mjs tests/live-slug-safety.test.mjs
```

These cannot migrate/backfill/deploy. The six safety/classification tests pass. Tests cover thirteen-row planning, unchanged SQL scope, secret/title suppression, unverified-tunnel refusal, SELECT-only queries, read-only Prisma diff invocation, and refusing to classify changed columns/unknown drops/changed constraints as cosmetic.

### Future write entry points — reference only, NOT approved to run now

Migration entry point: `npm.cmd run db:live:deploy`. Its PowerShell wrapper prompts for the backup path, then its Node tool uses the protected live profile, immutable committed payload, checksums, pending-list recheck, backup hash and exact interactive approval phrase. It applies ALL approved pending migrations, so it is only suitable once the verified pending set is exactly the reviewed slug addition.

Current working schema/manifest/slug migration are uncommitted. The immutable-payload guard intentionally blocks deployment from this original workspace. The clean nine-migration audit worktree has no slug migration to deploy. Do not weaken the guard or deploy from that old baseline to work around it. A reviewed immutable release payload requires separate future approval; no commit was made now.

The backfill script supports these argument forms (reference syntax only):

```text
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/catalog-slugs.ts --write-plan PRIVATE_PLAN_FILE
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/catalog-slugs.ts --apply-plan PRIVATE_PLAN_FILE --expect-database EXACT_IDENTITY_FROM_PLAN --confirm-catalog-writes-paused
```

**Do not run those in the current default shell for production.** scripts/catalog-slugs.ts imports dotenv/config and otherwise uses the normal local DATABASE_URL; it is not a live-profile-aware entry point. The live URL must be supplied only in a privately constructed, explicitly verified child environment or an already verified production runtime. Never paste/echo it, point the script at joro_local and call that production, or invent a nonexistent live-backfill npm action. A reviewed live binding and actual saved-plan/target/backup checks are still needed before a production backfill invocation can be approved.

Direct --apply is deliberately rejected. No blanket prisma migrate deploy command, history repair, db execute, reset or migration-generated diff execution is approved.

## Rollback and auto-deployment ordering

Hostinger auto-deployment is enabled per the user's confirmation. No hPanel release setting or rollback artifact was verified/changed here. A GitHub push must remain blocked until database/backfill verification has completed and the exact release is approved. Standard npm run build with migrations disabled does not enforce slug coverage; build success alone is not a database readiness gate.

Required future order: verify production backup/restoration and rollback artifact -> approve immutable slug migration payload -> apply only reviewed DDL -> generate/review/apply a verified live saved plan in an approved Product-writer window -> verify full production coverage/data/HTTP behavior -> separately approved GitHub push/Hostinger deployment with migrations disabled -> resume slug-aware product writers and recheck coverage. Do not let old-version writers create NULL-slug rows between coverage validation and cutover. Inventory writers can involve checkout, so writer quiescence/impact requires a separate operational decision; no checkout/payment/order flow was paused or modified here.

After publishing slug URLs, rollback must retain persistent mappings and a tested slug-capable resolver/ID redirect release. Reverting to an ID-only build would break canonical URLs. Retain the additive column/index/mappings and do not rewrite migration history. A specific Hostinger-compatible rollback artifact and production-derived restore rehearsal remain unverified.

**Exact next action:** obtain a recent, attributable production backup and verify restoration in an isolated matching MariaDB environment; confirm rollback artifact and release controls. Until that evidence and the live backfill binding/immutable-payload gates are ready, production writes remain **NO-GO**.
