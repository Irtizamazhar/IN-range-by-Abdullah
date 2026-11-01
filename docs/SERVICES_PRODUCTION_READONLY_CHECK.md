# JORO.PK production Services schema: read-only verification

Verified 1 November 2026 at 14:16 PKT through the existing managed SSH tunnel.
`JORO_DEPLOY_MIGRATIONS=false` throughout. No production data/schema writes,
migration application, commit, push or deployment were performed.

## Decision

**The narrowly prepared Services migration is compatible with the inspected server
and the existing Services table. It is a candidate for a separately approved migration,
not authorization to apply it now. Keep the application deployment on HOLD until the
schema change has been approved, applied and verified.**

The full database has pre-existing Prisma drift. Do not try to make the entire database
match schema.prisma with a blanket synchronization or a generated drift-repair migration.
The prepared Services SQL does not touch those unrelated differences.

## Actual server and schema

| Check | Verified result |
| --- | --- |
| Server | **11.8.9-MariaDB-log**, MariaDB Server |
| Identity | Exact configured production database/user/server port verified |
| Storage engine | InnoDB |
| Services row format | Dynamic |
| InnoDB page size | 16,384 bytes |
| Service table collation | utf8mb4_unicode_ci |
| Table names | Case-sensitive (`lower_case_table_names=0`); prepared SQL uses lowercase mappings |
| Existing Services table | `serviceoffering`, with the expected pre-change columns |
| New Services tables | `servicecatalog` and `servicelocationrequest` absent; no partial creation detected |
| Current moderation column | varchar(16), default APPROVED |

This server supports the proposed JSON, decimal, millisecond timestamp and default
syntax. MariaDB exposes the existing JSON city column as LONGTEXT with binary collation;
that is consistent with its JSON implementation, not a missing JSON column. The read-only
Prisma comparison reports no pre-existing column changes against the committed schema.

The new composite string indexes are approximately 1,040 and 1,528 bytes under utf8mb4,
within the modern InnoDB 3,072-byte key limit for the inspected 16KB/Dynamic configuration.
The nullable new catalog relationship avoids conflicts among existing legacy listings.

## Migration history

Baseline, active and archived migration checksum/history checks passed. The documented
historical rollback/retry is accounted for; there is no failed/unfinished or out-of-order
active migration. There are 25 archived history rows, representing the documented older
history including its rollback attempt.

These six active migrations are applied:

1. `0_baseline`
2. `20261018000000_add_want_report`
3. `20261022000000_pickup_management`
4. `20261024000000_customer_reset_otp`
5. `20261025000000_standalone_quote_service_booking`
6. `20261025010000_want_photos`

**Exactly one active migration is pending:**

`20261101000000_service_catalog_coverage`

This is verified production history, not merely a list of local migration folders.
No migration status/history rows were altered, repaired or marked applied.

## Pre-existing drift: do not automatically repair

A read-only comparison against the committed pre-Services schema found:

- Two database tables not represented in the Prisma datamodel:
  `wantofferlegacy20260914` and `wantpost`.
- 131 reported index redefinitions and multiple foreign-key replacement differences.
  Naming/capitalization differences are visible (for example the existing
  `ServiceOffering_vendorId_active_idx` versus the lowercase mapped convention).
- No added/removed/altered columns in that pre-change comparison.

The comparison proposes removing the two legacy tables to achieve a full schema match;
**they were not removed and must not be removed as part of Services deployment**.
The full semantics of every pre-existing index/FK difference have not been individually
reconciled. Do not assume every reported difference is harmless cosmetic drift.

Comparing production against the proposed schema adds only these column/table changes
on top of that same pre-existing drift:

- New `servicecatalog` and `servicelocationrequest` tables.
- Seven new `serviceoffering` columns: `catalogId`, `coverage`, `createdByAdmin`,
  `priceType`, `reviewedAt`, `reviewedBy`, `submittedAt`.
- Widen `moderationStatus` and change its future insert default to PENDING_APPROVAL.
- New moderation/submission index, vendor/catalog unique index, and catalog FK.

The prepared migration SQL applies only its explicit Services operations. It does not
execute the full Prisma diff or rename/rebuild unrelated indexes/FKs, and it does not
drop legacy tables. It also backfills the new `submittedAt` from `createdAt`; schema
comparison does not describe data backfills, so that statement was reviewed separately.

## Existing data and functionality

Snapshot counts at inspection:

| Records | Count |
| --- | ---: |
| Customers | 16 |
| Vendors | 1 |
| Products | 2 |
| Orders | 19 |
| Service listings | 0 |
| Service bookings | 0 |

No individual names, addresses, credentials, payment details or other customer records
were exported. These counts are a live snapshot, not a guarantee that the application
will not create more rows before a future migration.

The migration currently targets an empty service listing table, so its timestamp
backfill would affect zero existing listings at this snapshot. It does not modify
customer/vendor/product/order/payment/booking/inventory/earnings tables or historical
prices and snapshots. New catalog tables contain no automatic demo data or provider.

Remaining operational risks:

1. **Do not deploy the new code before its migration.** The new Services queries select
   missing columns and relations. With migrations disabled, a successful build does
   not create them. Public Services and vendor/admin Services features can fail at runtime.
   The homepage also awaits `publicServices({ take: 4 })` in its server-side Promise.all
   (`app/(user)/page.tsx:575`), so the risk extends to homepage rendering, not just a
   Services management tab. Do not deploy this code with the new schema still absent.
2. DDL/index creation may take metadata locks and can partially commit on MariaDB.
   Rehearse on staging and have a verified backup; no runtime lock-duration test was done.
3. Do not use generic schema synchronization to repair the unrelated legacy drift.
4. Apply only the reviewed pending migration after separate approval. Stop on any
   unexpected extra pending migration or history/schema discrepancy.
5. Test the intended administrator permissions and source-verified location behavior
   during the separately approved application release. Geographic source limitations
   remain documented in `SERVICES_BLOCKERS_REMEDIATION.md`.

## Prisma Client and build safety

Prisma Client **6.19.2** generation succeeded both normally and explicitly with:

```powershell
$env:JORO_DEPLOY_MIGRATIONS = 'false'
$env:NODE_ENV = 'production'
node node_modules/prisma/build/index.js generate
```

Generation is local filesystem work and did not connect to or change the database.
The build-plan safety tests passed: with this flag false, the existing build wrapper
only generates Prisma Client and compiles Next.js. It does not run database migrations.
Hostinger must install the locked dependencies and generate its own Linux client;
this Windows check is not a claim that a Hostinger build/deployment has already run.

Keep `JORO_DEPLOY_MIGRATIONS=false` in Hostinger as requested. Its setting was not
remotely changed or independently inspected through hPanel; this audit forced false
for every local command/child process. Do not select the migration-enabled build script.

## Simplest safe next process

1. Keep the current production application running; keep automatic migrations disabled.
2. Take a verified backup and restore it into production-like staging. Rehearse the
   single pending Services migration, validate JSON filtering/uniqueness/FK behavior,
   compare data summaries and test the new Services workflows.
3. Review and explicitly approve that narrow migration and an immutable release payload.
   Applying it is a separate action; this read-only audit does not authorize it.
4. After the approved migration is successfully applied and history/schema verified,
   approve the normal application deployment with the flag still false:

   ```sh
   npm run build
   npm start
   ```

   Ensure build dependencies/Prisma CLI are installed (`npm ci --include=dev` in the
   hosting build environment where applicable). Preserve existing auth/payment and
   database credentials; generate the client natively on Hostinger.
5. Smoke-test sign-in, public pages, Services/catalog/moderation and existing order/
   payment views. Do not silently mutate real orders as a test. Keep old artifacts and
   the additive schema for a controlled rollback/forward repair if required.

No write-capable database command was run during this task. Read-only schema comparison
used `migrate diff` with schema-datasource/datamodel inputs; the installed Prisma 6 CLI
explicitly documents this as read-only. No shadow database, SQL script execution or
database reset was used.

## Evidence and audit files

- `SERVICES_PRODUCTION_READONLY_RESULT.json`: sanitized server metadata, verified
  migration list, counts and human-readable schema comparison summaries.
- `scripts/check-services-production-readonly.mjs`: separate metadata-only audit;
  fixed SELECT allowlist and read-only diff, with no deployment/write branch.
- `tests/services-production-readonly.test.mjs`: SELECT allowlist and read-only CLI
  argument checks; both passed. The eight existing build-safety tests also passed.

The audit inspects the uncommitted working-tree proposal and labels it audit-only.
The existing committed-payload deployment guard was not changed or weakened. Exact
production identity and authentic migration-history checks were reused unchanged.
Owned SSH tunnel/process/listener checks were verified before connecting. Private
connection URLs were held in memory/child environment only, never printed or persisted.

This report supersedes earlier statements that production version/history/metadata
were unverified. Staging replay, backup restoration, final release approval and actual
Hostinger deployment remain unperformed.
