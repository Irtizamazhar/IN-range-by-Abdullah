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

`npm run dev` only starts Next.js (`next dev`); it does not check, generate or apply migrations. The migration
cycle runs only when you start it:

1. `git pull --rebase` first, so you start from your teammate's latest migrations.
2. Edit `prisma/schema.prisma`. Give new models a lowercase `@@map("tablename")`.
3. Run `npm run db:migrate` (`npm run db:migrate -- --name <name>` to choose the name). `scripts/db-migrations.mjs`:
   - applies committed migrations you do not have yet;
   - generates a timestamped migration named after the change (for example `20261020101500_add_giftcard_table`);
   - applies it to your local development database if it is purely additive;
   - regenerates Prisma Client, updates `prisma/migration-manifest.json`, and stages the new migration folder and
     the manifest with `git add`. Stop the dev server first on Windows, where it locks Prisma Client.
4. Read the generated `prisma/migrations/<timestamp>_<name>/migration.sql`.
5. Commit `prisma/schema.prisma`, the migration folder, `prisma/migration-manifest.json` and the code together.
6. `git pull --rebase`, then `git push`. Never force-push.

`node scripts/db-migrations.mjs dev-server` still offers the former automatic mode (migrate on start and on every
`schema.prisma` save) for anyone who wants it; it is no longer part of `npm run dev`.

### Changes that need approval

The cycle generates the SQL first and applies it only if every statement is additive (new tables, optional
columns, columns with a default, ordinary indexes, foreign keys and unique keys on new tables). It stops,
applies nothing, and explains each statement when a change can lose data or fail on existing rows:

| Change | Why it stops | Usual safe approach |
| --- | --- | --- |
| Dropping a table or column, changing the primary key | Data is deleted | Remove the code first; drop in a later release after a backup |
| Renaming a column or table | Prisma generates drop + add, which deletes the data | Edit the SQL to `RENAME COLUMN` / `RENAME TABLE` before approving |
| Changing a type, length, precision, nullability, default or enum values | Can fail or truncate existing values | Check existing data; widen first, or stage the change |
| Adding a required column without a default | Fails on a table that has rows | Add a `@default`, or make it optional, backfill, then make it required |
| New unique constraint or foreign key on an existing table | Fails if existing rows violate it | Check for duplicates or orphan rows first |
| Any other statement it does not recognise | Unknown effect | Review it |

Then either approve (after reviewing or editing the SQL) with `npm run db:migrate:approve`, or discard the
unapplied migration with `npm run db:migrate -- --discard` and change the schema. If you change the schema again
before approving, the unapproved migration is regenerated automatically unless you edited its SQL.

The cycle also stops, without changing anything, on drift (the development database was changed outside the
migrations), on a previously failed migration, on database history that is not in `prisma/migrations`, on
duplicate migration timestamps, and on a missing or non-local `DATABASE_URL`.

### Safety rules built into the tooling

- Development commands only accept `localhost`, `127.0.0.1` or `::1` (extra hosts via `DEV_DATABASE_HOSTS`),
  refuse database names that look like Hostinger's (`u<digits>_...`), and refuse `NODE_ENV=production`.
- Prisma is never given a terminal, so it can never prompt for, or perform, a database reset. Nothing runs
  `prisma db push`, `prisma migrate reset` or `prisma migrate resolve`.
- Never edit a migration after it has been applied anywhere; add a new migration instead. The check below
  detects edited migrations.
- Keep changes compatible with the code that is still running while a migration applies.
- Never execute the SQL produced by `prisma migrate diff` against production (see "Accepted differences").

### Missing-migration checks

`prisma/migration-manifest.json` records a fingerprint of `schema.prisma` (comments and formatting ignored) and
the SHA-256 of every migration. `npm run db:check` fails when the schema changed without a migration, a
migration is missing or unrecorded, a migration was edited, timestamps collide, or the lock file is wrong.
It runs:

- in the optional Git `pre-push` hook (`.githooks/pre-push`) against the commit being pushed. `npm install` no
  longer enables it; to opt in, run `node scripts/install-git-hooks.mjs` once;
- in `npm test` (`tests/migration-workflow.test.ts`);
- in the Hostinger build (`JORO_DEPLOY_MIGRATIONS=true`) and `npm run build:deploy`, before any database change.

`npm run db:check:full` additionally replays every migration into a temporary local database and compares the
result with `schema.prisma` exactly. If Prisma Client cannot be regenerated (for example on Windows while a dev
server holds it), `npm run db:check:full -- --update-manifest` records the manifest after that replay passes.

### Migration tests

There is no CI workflow. Before pushing a schema change, run `npm test`, `npm run db:check` and
`npm run db:check:full`. The migration scenarios run locally against a disposable server, never a database you use:
`MIGRATION_TEST_SERVER_URL=mysql://user:password@127.0.0.1:3306 npm run test:migrations:scenarios`
(also `test:migrations:watch` and `test:migrations:deploy`). They only create and drop `joro_disposable_*` databases.

### Two developers on `main`

- Pull before changing the schema and before pushing. `npm run db:migrate` applies the other developer's migrations.
- If both of you changed the schema, `prisma/migration-manifest.json` conflicts on purpose. Resolve the
  conflicts in `schema.prisma`, keep both migration folders, take either side of the manifest, then run
  `npm run db:migrate`. It applies the other migration, generates a follow-up migration if the merged schema
  still needs one, and rewrites the manifest. Commit the result.
- Two migration folders with the same timestamp, or a migration already applied locally that is no longer in
  `prisma/migrations`, are reported instead of being guessed at.

### Local databases created before the baseline

A development database that still has the archived history reports "migration history that is not in
prisma/migrations". Either point `DATABASE_URL` in `.env.local` at a new empty database (the cycle creates the
whole schema), or give the existing local database the same one-time baseline as production: confirm with
`npx prisma migrate diff --from-url <local> --to-schema-datamodel prisma/schema.prisma` that only accepted
differences remain, run `npx prisma migrate resolve --applied 0_baseline` against that local database, then
`npm run db:migrate`.

## Hostinger deployment

- Build command: `npm run build` (the only choice Hostinger's dropdown offers). `scripts/build.mjs` decides
  what it does from the Hostinger environment variable `JORO_DEPLOY_MIGRATIONS`:
  - unset or `false` (also every local build): `prisma generate`, then `next build`. No database is touched.
  - `true`: in order
    1. `node scripts/db-migrations.mjs deploy-preflight`: requires `DATABASE_URL` (mysql://), verifies the
       committed migrations against the manifest, checks the database connection, and stops if the database
       already has tables but `0_baseline` is not recorded (read-only checks);
    2. `prisma migrate deploy`: applies committed migrations only, under Prisma's database lock, so concurrent
       deployments wait instead of running twice;
    3. `prisma migrate status`: prints the migration state to the build log and fails unless it is up to date;
    4. `prisma generate`, then `next build`.
  - any other value: the build stops before any step, so a typo can neither skip nor run migrations silently.
  Each step runs only if the previous one succeeded; the build log starts with
  `[build] Production migrations enabled` or `disabled`. Only the real process environment is read, never
  `.env` or `.env.local`, so a local file cannot turn migrations on. `npm run build:deploy` runs the same
  migration chain regardless of the variable. Hostinger's documentation says the live version is switched only
  after a successful build; confirm this once on the first real deployment.
  Set the variable only after the one-time baseline below has been completed; before that, step 1 stops the
  deployment without touching the database.
- Start command: `npm start`.
- `DATABASE_URL` must be set in Hostinger's environment variables. Hostinger injects environment variables
  into the build and the running app. Never commit it. Development and production use different credentials;
  the development tooling refuses non-local hosts.
- After a deployment that applied a migration, the build log lists `Applying migration ...`; check the new
  tables or columns, then the affected pages.

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
`20261018000000_add_want_report` migration then runs through the permanent Hostinger build (`npm run build` with `JORO_DEPLOY_MIGRATIONS=true`),
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
7. In hPanel, keep the build command `npm run build`, add the environment variable
   `JORO_DEPLOY_MIGRATIONS=true`, and redeploy. The build log must show
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

If the build in step 7 fails, set `JORO_DEPLOY_MIGRATIONS=false` in hPanel first. A failed
`20261018000000_add_want_report` leaves an unfinished history row, and every later migrating build
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

After the cause is fixed, mark the failed attempt as rolled back, set `JORO_DEPLOY_MIGRATIONS=true` again and redeploy:

```sql
UPDATE `_prisma_migrations` SET `rolled_back_at` = NOW(3)
WHERE `migration_name` = '20261018000000_add_want_report' AND `finished_at` IS NULL AND `rolled_back_at` IS NULL;
```

To undo the whole change after a successful build, while `wantreport` is still empty
(`SELECT COUNT(*) FROM wantreport;` returns `0`), set `JORO_DEPLOY_MIGRATIONS=false` in hPanel, then:

```sql
DELETE FROM `_prisma_migrations` WHERE `migration_name` IN ('0_baseline', '20261018000000_add_want_report');
DROP TABLE `wantreport`;
```

Restoring the backup is a last resort: it loses every order and change made after the backup was taken.
