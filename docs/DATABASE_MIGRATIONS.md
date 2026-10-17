# Database migrations

## Why the history was baselined (2026-10-17)

The original migration history could not be replayed on an empty database, so
`prisma migrate dev` failed with `P3006` / `1824 Failed to open the referenced table 'product'`.

- The original tables (`customer`, `product`, `order`, `vendor`, `vendorproduct`,
  `vendorshoporder` and 15 others) were created with `prisma db push` and never had a
  migration. The first migration, `20260403140000_add_reviews`, already referenced `Product`.
- The history merged two database lineages: 21 tables were created twice, and
  `20260913090000_joro_merge_reconciliation` and `20260913100000_legacy_marketplace_reconciliation`
  each assume the other did not run.
- Migrations before `20261014…` use PascalCase table names, while the schema maps
  every model to the lowercase names used in production. Production table names are
  case-sensitive (`lower_case_table_names=0`).

The old migrations are kept unchanged in `prisma/migrations_archive/` for reference.
Prisma does not read that folder. The active history is:

| Migration | Purpose |
| --- | --- |
| `0_baseline` | Creates the complete schema from `prisma/schema.prisma`, plus the six default `servicecommissionrange` rows. Existing databases never execute it; it is recorded as applied. |
| `20261018000000_add_want_report` | Creates `wantreport`, which production lacks. Idempotent: on a database where `0_baseline` ran, it changes nothing. |

## Workflow for every schema change

1. Edit `prisma/schema.prisma`. Give new models a lowercase `@@map("tablename")`.
2. Run `npx prisma migrate dev --name <descriptive_name>` against your local database.
3. Read the generated `migration.sql`, then test the feature locally.
4. Commit the schema change, the new migration folder, and the application code together, then push.
5. The Hostinger build applies pending migrations before building (see below).

Rules:

- Never run `prisma db push`, `prisma migrate reset`, or manual `ALTER TABLE` statements against production.
- Never edit a migration after it has been applied anywhere; add a new migration instead.
- Keep changes compatible with the code that is still running while the migration applies:
  add columns as nullable or with a default, and remove old columns in a later release.
- Never execute the SQL produced by `prisma migrate diff` against production (see "Accepted differences").

## Hostinger deployment

- Build command: `npm run build:deploy`
  (`prisma migrate deploy`, then `prisma generate`, then `next build`; a failed migration stops the build).
  Use it only after the one-time baseline below has been completed.
- Start command: `npm start`.
- `DATABASE_URL` must be set in Hostinger's environment variables. Hostinger injects environment variables
  into the build and the running app. Never commit it.

## Local testing

Production runs MariaDB 11.8.9 with `lower_case_table_names=0`. The physical table names are the lowercase
`@@map` names, except `OrderConfirmationEmail`, which has no `@@map` and is mixed-case.

Tested on disposable local databases only, on MySQL 8.0.43 (Windows) and on MariaDB 11.8.9 with
`lower_case_table_names=0` and a case-sensitive data directory:

- `migrate deploy` of both migrations into an empty database succeeds; `migrate status` reports it up to date.
- `migrate diff --from-url` from the resulting database to `schema.prisma` reports no difference.
- 67 tables, 114 foreign keys and the six default `servicecommissionrange` rows are created.
- Every foreign key references an existing table by its exact, case-sensitive name.
- `20261018000000_add_want_report` was tested where `wantreport` already exists (no change), is absent
  (created identically to `0_baseline`), is partial (missing parts added), has the wrong columns (stops with
  `Unknown column 'wantreport_existing_table_does_not_match_prisma_schema'`), and on a rerun (no change).

### Windows MariaDB and the automatic shadow database

On the Windows build of MariaDB with `lower_case_table_names=0`, `prisma migrate dev` fails with
`P3006` / `Unknown database 'prisma_migrate_shadow_db_<uuid>'`. Prisma names its automatic shadow database
with hyphens. With an explicit, plainly named shadow database, `migrate dev` works. This affects only
`migrate dev`; `migrate deploy` never uses a shadow database. Local development on MySQL 8 is not affected.
Linux MariaDB was not tested.

When developing against MariaDB, create an empty database such as `joro_shadow`, add
`shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` to the `datasource` block, and set `SHADOW_DATABASE_URL`
in your local environment only. Never point it at a database that holds data; Prisma resets it.

On MariaDB, `prisma migrate diff --from-migrations ... --shadow-database-url ...` also reports all 25 `Json`
columns as "type changed" (MariaDB stores JSON as `LONGTEXT` with a `json_valid` CHECK). Comparing a live
database with `--from-url` does not, so use `--from-url` for MariaDB comparisons.

## Production state (2026-10-17 backups)

### Migration history

Production's `_prisma_migrations` table has 25 rows for 24 archived migrations:
`20260914000000_step8_top_vendors` has one rolled-back attempt and one successful run. No row is failed
(`finished_at` NULL and `rolled_back_at` NULL). The other 8 archived migrations, from
`20261014000000_coupon_system` onwards, have no row; their changes were applied manually. These old rows stay
in place: Prisma ignores them once `0_baseline` is recorded, which was rehearsed on the real backup.

### Accepted differences

The structure-only export was imported into a disposable MariaDB 11.8.9 database and compared with a
reference database built from the two migrations, object by object (tables, engines, collations, every
column's type, nullability, default, charset and collation, indexes, foreign keys, parent tables,
referential actions, CHECK constraints), and with `prisma migrate diff --from-url`. Everything matches
except the following, each of which is accepted:

| Difference | Explanation | Action |
| --- | --- | --- |
| `wantreport` missing (2 unique indexes, 3 indexes, 3 foreign keys) | Never created in production | Created by `20261018000000_add_want_report` |
| Extra tables `wantpost` and `wantofferlegacy20260914`, and the foreign key `WantPost_customerId_fkey` (`wantpost` -> `customer`) | Legacy data kept by the old reconciliation migration | Preserve. Never drop them; `migrate deploy` never drops tables |
| `_prisma_migrations` | Prisma's own history table | Kept; ignored by comparisons |
| 156 index names and 104 foreign-key names differ only in the capitalization of the table prefix (`AdminAuditLog_...` vs `adminauditlog_...`); 25 of the indexes are the automatic indexes behind foreign keys | Created before the lowercase `@@map` names existed | Cosmetic. MariaDB matches index and foreign-key names case-insensitively (tested), so future migrations that drop or rename them work. Left unchanged |

`couponcollection.updatedAt` and `vendorcoupon.updatedAt` have `DEFAULT CURRENT_TIMESTAMP(3)` in production.
This is harmless (Prisma sets `updatedAt` on every write anyway). The schema declares both as
`@default(now()) @updatedAt`, and `0_baseline` contains the same defaults, so these columns now match.

Foreign keys: the schema defines 114. Production has 112 = 114 - 3 (`wantreport`) + 1 (`WantPost_customerId_fkey`).
After `20261018000000_add_want_report` it has 115 = 114 + 1.

`prisma migrate diff` from production to the schema will keep listing the legacy tables and the
capitalization-only names. Once `wantreport` exists, its generated SQL would drop both legacy tables, drop 105
and add 104 foreign keys, and drop and recreate 131 indexes, so it must never be executed against production.

## One-time production baseline (PENDING: not yet performed; requires separate approval)

`0_baseline` is recorded as applied with one SQL statement in phpMyAdmin. The pending
`20261018000000_add_want_report` migration then runs through the permanent `npm run build:deploy` build,
which uses Hostinger's production environment variables. No Prisma command is run by hand against production.

The checksum in step 6 is the SHA-256 of the exact committed `prisma/migrations/0_baseline/migration.sql`.
Record the baseline only after that file is final and deployed. If the file changes, the checksum changes.
Compute it with `git show HEAD:prisma/migrations/0_baseline/migration.sql | sha256sum`.

Every step below, including each recovery statement, was rehearsed on disposable restores of the real
2026-10-17 backup on MariaDB 11.8.9 with `lower_case_table_names=0`. Row counts of all existing tables
were unchanged.

1. Deploy the commit containing both migrations with the current build command (`npm run build`).
   This does not touch the database. Confirm the site works.
2. Choose a low-traffic window and pause admin edits. The change itself takes seconds; the site stays up.
3. Take a fresh full backup (structure and data) and verify it by restoring it into a disposable local
   MariaDB 11.8 database and comparing every table's row count with the backup file. Do not continue until
   it verifies.
4. Read-only checks in phpMyAdmin. Stop if any result differs:
   - `SELECT @@lower_case_table_names;` returns `0`.
   - `SELECT COUNT(*), SUM(finished_at IS NULL AND rolled_back_at IS NULL) FROM _prisma_migrations;` returns `25`, `0`.
   - `SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name IN ('0_baseline', '20261018000000_add_want_report');` returns `0`.
   - `SHOW TABLES LIKE 'wantreport';` returns no rows.
5. Confirm the checksum of the deployed commit (see above).
6. Record the baseline in phpMyAdmin:

   ```sql
   INSERT INTO `_prisma_migrations` (`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`)
   VALUES (UUID(), '<checksum from step 5>', NOW(3), '0_baseline', NULL, NULL, NOW(3), 0);
   ```

   Verify: `SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name = '0_baseline';` returns `1`.
7. In hPanel, set the build command to `npm run build:deploy` and redeploy. The build log must show
   ``Applying migration `20261018000000_add_want_report` `` and `All migrations have been successfully applied.`
8. Verify in phpMyAdmin:
   - `SELECT COUNT(*) FROM _prisma_migrations;` returns `27`.
   - `SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport';` returns `3`.
   - `wantpost` and `wantofferlegacy20260914` still exist.
   Then test reporting a Want on the site. Every later build log shows `No pending migrations to apply.`

### Recovery (each statement rehearsed)

If step 6 must be undone before the build in step 7:

```sql
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '0_baseline';
```

If the build in step 7 fails, set the build command back to `npm run build` first. A failed
`20261018000000_add_want_report` leaves an unfinished history row, and every later `npm run build:deploy`
stops with `P3009` until it is resolved. Before retrying, verify:

1. The build log's `P3018` error and its database error code, which name the cause.
2. The history row: `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = '20261018000000_add_want_report';`
   must show `finished_at` NULL and `rolled_back_at` NULL.
3. The state of `wantreport`: `SELECT COUNT(*) FROM wantreport;` and its columns
   (`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport';`).
   A table created partly by the migration is completed by the retry. A table whose columns do not match the
   schema must be investigated before anything is changed.
4. The parent tables exist with exact names:
   `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME IN ('want', 'customer', 'vendor');`
   returns all three.

After the cause is fixed, mark the failed attempt as rolled back and redeploy with `npm run build:deploy`:

```sql
UPDATE `_prisma_migrations` SET `rolled_back_at` = NOW(3)
WHERE `migration_name` = '20261018000000_add_want_report' AND `finished_at` IS NULL AND `rolled_back_at` IS NULL;
```

To undo the whole change after a successful build, while `wantreport` is still empty
(`SELECT COUNT(*) FROM wantreport;` returns `0`), set the build command back to `npm run build`, then:

```sql
DELETE FROM `_prisma_migrations` WHERE `migration_name` IN ('0_baseline', '20261018000000_add_want_report');
DROP TABLE `wantreport`;
```

Restoring the backup is a last resort: it loses every order and change made after the backup was taken.
