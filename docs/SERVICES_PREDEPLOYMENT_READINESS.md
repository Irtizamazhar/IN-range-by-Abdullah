# Services production readiness review

> Current remediation status: [SERVICES_BLOCKERS_REMEDIATION.md](SERVICES_BLOCKERS_REMEDIATION.md).
> Geographic checks and the approved private-profile cleanup are fixed, and the two
> deployment-safety tests now use isolated committed snapshots. Production remains
> on HOLD for staging, backup/restore, metadata verification and key rotation.
> The findings below are the historical pre-fix review.

Review date: 1 November 2026 (Asia/Karachi).
Project: `C:\Users\hamid\Pictures\IN-range-by-Abdullah`.

**Decision: HOLD production deployment.** Prisma generation is resolved and the
configured Geoapify key is accepted, but live location matching exposed a correctness
blocker. Production database metadata, migration replay and backup readiness are not
verified. No production connection, migration, commit, push or deployment was made.

## 1. Configuration: exact names and latest local verification

No secret values, fragments or hashes were printed or recorded. The developer updated
configuration during this review; this table reflects the final snapshot, not the
earlier unconfigured signing-secret state.

| Variable | Requirement | Latest local result | Hostinger action |
| --- | --- | --- | --- |
| `GEOAPIFY_API_KEY` | Required for new online service-location searches | Configured in `.env` and `.env.live.local`; copies match; live API accepted it | Set in server environment; never `NEXT_PUBLIC_` |
| `SERVICE_LOCATION_SECRET` | Strongly recommended dedicated signing secret; otherwise code uses `NEXTAUTH_SECRET` | Configured in both files; copies match; at least 32 characters; distinct from API/auth secrets | Use a stable, cryptographically random secret, consistent across instances and releases |
| `SERVICE_LOCATION_DAILY_LIMIT` | Optional positive integer; code defaults to `2500` | Unset; default used | Explicit `2500` is reasonable initially, subject to provider plan and instance count |
| `DATABASE_URL` | Existing app/build database connection; required in production | Present in normal local environment; loopback target, not the managed live tunnel | Set the verified Hostinger runtime database URL, not the developer connection |
| `NEXTAUTH_SECRET` | Existing customer/admin authentication requirement and location fallback | Configured, at least 32 characters | Preserve the existing production value to avoid session disruption |
| `NEXTAUTH_URL` | Existing canonical application origin | Present locally, but does not match `https://joro.pk` or `https://www.joro.pk` | Preserve/configure the actual canonical HTTPS production origin; do not copy the local value |
| `VENDOR_JWT_SECRET` | Existing vendor authentication; production has no development fallback | Configured, at least 32 characters | Preserve the existing production value |
| `JORO_DEPLOY_MIGRATIONS` | Existing deployment control; unset/`false` avoids DB migrations | Not configured in runtime files | Keep `false` normally; enable `true` only for an explicitly approved migration release |
| `NPM_CONFIG_INCLUDE` | Build configuration, needed if Hostinger otherwise omits dev dependencies | Hostinger setting not inspected | `dev` ensures the locally declared Prisma CLI and build tools are installed |
| `NODE_ENV` | Standard production runtime setting | Hostinger runtime not inspected | Use `production`; build installation must still include dev dependencies |
| `PORT` | Hosting-assigned runtime port | Not changed | Let Hostinger supply it; `npm start` runs `next start` |
| `JORO_NEXT_DIST_DIR` | Optional local verification override | Not required for release | Leave unset for normal `.next` build/start |

No new payment, checkout, SMTP, OAuth or upload credentials are required by Services.
Preserve all existing production integration variables. For the existing private-launch
gate, retain the intended `MAINTENANCE_MODE`, `PREVIEW_ALLOWED_EMAILS`,
`PREVIEW_PASSWORD_HASH` and `PREVIEW_SESSION_SECRET` configuration; do not enable or
disable that gate accidentally during a Services release.

Next.js does **not** automatically load `.env.live.local`. This file belongs to the
project's dedicated live-database/tunnel tooling, not to the application runtime.
The profile intentionally lacks the normal application `DATABASE_URL` and auth secrets;
its `JORO_LIVE_*` values are handled separately. A secret's character count does not
prove randomness; use a trusted random generator when provisioning production secrets.

### Blocking private-profile placement error

`scripts/lib/live-db-safety.mjs:122` accepts only `LIVE_SETTINGS` and
`JORO_LIVE_DB_PASSWORD`. The final profile contains two unexpected names:

- `GEOAPIFY_API_KEY`
- `SERVICE_LOCATION_SECRET`

The actual validator refused the profile with:

> Unexpected live profile setting. No connection attempted.

After approval, remove **only these two service entries** from `.env.live.local`,
keeping their runtime copies in `.env`/`.env.local` and provisioning them separately
in Hostinger. Preserve every existing database/tunnel setting and password. Do not
weaken the safety allowlist or load the live DB profile into normal development.
No private environment file was changed by this review.

A credential appeared in the supplied IDE context. Rotate that exposed API key before
production; update runtime copies privately. This does not require rotating existing
customer/vendor session secrets.

## 2. Prisma Client generation: resolved

The exact query-engine DLL was loaded by this project's local Next.js server. The
process owner and project-specific Next dev launcher were verified before stopping
only those processes. Then:

```powershell
npx.cmd prisma generate
```

completed with exit code 0 and generated Prisma Client **6.19.2**. The project local
development launcher was restarted hidden, reached Ready, and detected the subsequent
environment reload. No unrelated process or file was removed. No DB connection or
migration is part of `prisma generate`.

Prisma CLI and Client are both installed at **6.19.2**, matching the lockfile. Their
package.json ranges remain `^6.19.0`; no packages were upgraded. Do not run the CLI's
suggested major-version upgrade as part of this release.

On Windows, running Prisma generation/build while the dev server uses its DLL can
recreate the lock. Stop the project's dev server before regenerating/building, then
restart it. Hostinger must install/generate its own Linux client; do not upload the
Windows `node_modules`, DLL or a Windows-generated Prisma Client. Native generation
on the target platform is already the configured approach; no speculative binary
target was added.

## 3. Geoapify live verification: key works; location correctness blocks release

Fourteen read-only autocomplete requests were made using the configured key:
eleven city queries and three Lahore-area queries. All returned HTTP 200. No database
record or provider configuration was changed. This consumes a small amount of the
provider quota but performs no purchases or subscription changes.

City searches returned accepted candidate types for Lahore, Islamabad, Rawalpindi,
Karachi, Faisalabad, Peshawar, Multan, Sialkot, Abbottabad, Wah Cantt and Swabi.
Wah Cantt returned the canonical label **Wah Cantonment**. This proves successful
queries, not nationwide geographic completeness or that every candidate is suitable.

Observed suitability problems:

| Live query | Observed result | Current implementation |
| --- | --- | --- |
| `DHA`, filtered to the first Lahore city result | `Walled City of Lahore`, type `suburb`; also `DHA EME Sector`, reported city `Khanpur` | Accepts both by country/type; unrelated query fallback is not rejected |
| `Gulberg`, same Lahore filter | `Gulberg`, reported city `Lahore Cant` | Accepts it and signs it under the selected Lahore place ID without reconciling the differing parent-city label |
| `Johar Town`, same Lahore filter | `Johar Town` and `Johar Avenue` in Lahore; `Johar View` reported city `Samsani Khui` | Accepts all three |
| `Karachi` | First candidate `Karachi Division`, type `city` | Country/type filter treats this administrative candidate as an eligible city |
| `Faisalabad` / `Peshawar` | First candidates included `Faisalabad City Tehsil` / `Peshawar City Tehsil`, type `city` | Same broad acceptance |

The differing city labels alone do not establish physical out-of-boundary placement;
metropolitan and source boundaries can differ. They do establish that the current
code has not independently verified the exact city-area relationship claimed by its
signed attestation. The unrelated `DHA` fallback establishes a separate relevance gap.

Evidence: `lib/service-locations.ts:44` validates country and a broad result type;
`:62` sends the provider boundary filter; `:68` accepts those results; `:72` signs
each result with the requested city's ID. HMAC verifies that the application issued
the claim. It does not prove that the geographic claim was accurate.

**Required before release:** design a fail-closed result suitability check using
reliable source hierarchy/boundary evidence, distinguish administrative divisions
from selectable cities, reject unrelated fallback matches, and explicitly handle
metropolitan alias ambiguity. Add regression fixtures based on these actual response
shapes and repeat live acceptance after the fix. Do not invent a neighborhood list or
silently treat all name variants as equivalent. No business-logic fix was made during
this readiness review; it requires approval.

The application has 400ms debouncing, a bounded 15-minute cache, per-IP limiting and
per-process upstream limits. Quota/rate limits are not distributed across instances.
Hostinger/provider aggregate limits and attribution remain release checks.

## 4. Migration review

There is exactly **one new migration** relative to the existing checkout:

`prisma/migrations/20261101000000_service_catalog_coverage/migration.sql`.

The six earlier active migration files have not been changed. Schema validation and
manifest checks pass for all seven active migrations. Archived history is not to be
replayed as a new migration chain.

| Operation | Compatibility and data impact |
| --- | --- |
| Create `servicecatalog` | New table, no automatic public listings or vendor rows |
| Widen `moderationStatus` 16 → 24 and change insert default | Existing statuses remain unchanged; future vendor inserts default pending |
| Add nullable `catalogId` and `coverage` | Preserves legacy listings without fabricated mappings/coverage |
| Add `priceType` default `STARTING_FROM` | Existing rows receive a label; existing numeric prices are not modified |
| Add submission/review/admin metadata | Adds columns only; no auth account relationship is rewritten |
| Unique `(vendorId,catalogId)` | Legacy rows have NULL catalog IDs; MySQL allows multiple NULL unique-key entries; new duplicate provider/catalog combinations are prevented |
| Catalog FK, `ON DELETE RESTRICT` | Requires compatible table engine, character set and collation; no cascading deletion |
| New moderation index | Improves moderation ordering; build may lock/rebuild the table |
| `UPDATE serviceoffering SET submittedAt=createdAt` | Writes only the new timestamp on existing offerings; it is a backfill, so the migration is **not literally read-only/add-only DDL** |
| Create `servicelocationrequest` | New table; no existing support/user rows are changed |

No migration statement modifies `customer`, `adminuser`, `vendor`, `product`,
`orderservice`, `order`, payment records, earnings, inventory or booking snapshots.
No DROP, DELETE, reset, currency/price conversion or production seed is included.

The SQL is consistent with the existing baseline's lowercase table mappings and
`utf8mb4_unicode_ci` collation. The JSON column and millisecond timestamp syntax match
features already used by that baseline. The two composite string indexes need modern
InnoDB index limits (approximately 1,040 and 1,528 bytes for their utf8mb4 key columns,
both below 3,072). This is not a claim that an uninspected legacy server supports them.

**Conditional compatibility, not certified production compatibility:** production
MySQL/MariaDB version, InnoDB/row format, actual table collation, schema drift, applied
history, privileges, row counts, available space and migration duration were not
queried. The private profile refuses validation and the new payload is uncommitted;
no safety check was bypassed to connect anyway. Disposable MySQL/MariaDB replay has
not been completed. Static schema/hash checks cannot replace those checks.

MySQL DDL can commit statement by statement. If the catalog creation succeeds but a
later ALTER fails, blindly rerunning SQL can fail because the first table now exists.
The ALTER and backfill can take locks and consume disk/log space. Rehearse duration
against a representative staging copy before selecting a maintenance window.

## 5. Read-only database preflight still required

After correcting the local private profile, approving an immutable release payload,
and verifying the managed connection, run only the documented **check/status** actions
for inspection. The present live safety helper requires committed, unchanged migration
files even for its live check. Do not weaken that guard to get past the current hold.

The following SQL is for an authorized read-only metadata session in phpMyAdmin or
equivalent; it was **not executed** during this review:

```sql
SELECT VERSION() AS server_version, @@version_comment AS server_flavor,
       DATABASE() AS selected_database, @@default_storage_engine AS default_engine;

SELECT TABLE_NAME, ENGINE, ROW_FORMAT, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('serviceoffering','orderservice','order','customer',
                     'vendor','product','adminuser');

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'serviceoffering'
ORDER BY ORDINAL_POSITION;

SHOW INDEX FROM serviceoffering;

SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM _prisma_migrations ORDER BY started_at, id;

SELECT moderationStatus, COUNT(*) AS row_count
FROM serviceoffering GROUP BY moderationStatus;
```

Also verify that the new table/column/index names do not already exist from a partial
attempt, the migration user has required CREATE/ALTER/INDEX/REFERENCES/UPDATE rights,
all six earlier active migrations and authentic archived history match, and the new
migration is the only intended pending migration. Do not rerun baseline or use
`migrate resolve` to hide a mismatch.

Capture pre/post counts and relevant price/status summaries for customers, vendors,
products, offerings, bookings and orders privately; compare after application. Verify
a restorable backup and staging restore before approval. No record-level personal
data needs to be printed into chat.

## 6. Exact local commands (safe validation, no production migrations)

These checks were executed:

```powershell
npx.cmd prisma generate
npx.cmd prisma validate
node scripts/db-migrations.mjs check
npx.cmd tsc --noEmit --incremental false
git diff --check
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/service-management.test.ts tests/checkout.test.ts tests/checkout-offers-addresses.test.ts tests/checkout-release-safety.test.ts tests/customer-account.test.ts tests/build-steps.test.ts tests/db-live-safety.test.mjs
```

Results: Prisma generation/validation, manifest, TypeScript and diff checks passed.
Extended tests: **72 total, 70 passed, 2 failed**. Both failures are the existing live
safety tests requiring a committed, unchanged migration payload. This working tree
intentionally has an uncommitted new migration under the user's no-commit restriction.
The guard was left intact. Services/checkout/account focused tests passed, as did the
build-step safety tests; no real database writes occur in these tests.

The prior implementation's production compilation and responsive fixture-browser
checks passed; those are recorded in `SERVICES_MANAGEMENT.md`. They do not override
the live geographic findings above. No new production build or deploy was needed to
discover these readiness blockers.

## 7. Hostinger deployment order — future, approval required

The project uses Prisma **6.19.2** and its existing Prisma 6 CLI commands. Do not copy
Prisma 8 migration commands from newer documentation or upgrade packages during release.

### Before any production write

1. Resolve geographic result suitability; rerun tests and live acceptance.
2. Correct the private DB profile placement without changing DB credentials. Provision
   runtime variables in Hostinger, preserve existing session/integration secrets, and
   rotate the API credential exposed in IDE context.
3. Complete disposable/staging database replay and schema comparison, using the actual
   production server family/version. Verify backups and rollback artifact.
4. Approve and produce the immutable source release through the existing repository
   workflow. No commit/push is authorized by this review.
5. Perform read-only production metadata/history checks. Freeze service listing/catalog
   writes for the migration/cutover window; do not blindly stop or modify payment/order
   processing. If whole-site maintenance is needed, plan it explicitly.

### Installation/build/runtime settings

Use the repository's `package-lock.json` and a Hostinger-supported Node version tested
with the same lockfile (local verification ran on Node 24.21.0; the actual Hostinger
runtime version has not been inspected). Make dev dependencies available during build
because `prisma`, TypeScript and other build tools are currently dev dependencies.

Where an approved build shell is available:

```sh
npm ci --include=dev
node scripts/db-migrations.mjs check
```

Installation's existing postinstall generates Prisma Client; it does not migrate.
The explicit build step generates again and fails hard if that step fails. Avoid
installing only production dependencies: a missing local CLI must not cause `npx` to
fetch an unrelated newer Prisma version. Hostinger normally runs `npm ci` for npm
projects with a lockfile; verify its logs and build dependency settings.

### Option A: approved migrations in Hostinger's existing build wrapper

Set these **in hPanel's actual environment**, not merely inside a file:

```dotenv
JORO_DEPLOY_MIGRATIONS=true
NPM_CONFIG_INCLUDE=dev
```

Use build command:

```sh
npm run build
```

The inspected wrapper executes exactly:

```sh
node scripts/db-migrations.mjs deploy-preflight
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js generate
node node_modules/next/dist/bin/next build
```

It stops on any failed step. Preflight verifies manifest and basic DB/baseline
reachability; it does not prove absence of all schema drift or a restorable backup.
`migrate deploy` applies **all** pending active migrations, so the separately verified
pending list must contain only the approved intended changes.

Equivalent existing script, if selectable in the Hostinger build settings:

```sh
npm run build:deploy
```

This explicitly enables migrations regardless of the environment flag. Do not run it
for ordinary future builds unless a migration is approved.

### Option B: separately approved migration job, followed by app build

In the verified production job environment only, after approval:

```sh
node scripts/db-migrations.mjs deploy-preflight
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js migrate status
```

Then set `JORO_DEPLOY_MIGRATIONS=false` for the application build and run:

```sh
npm run build
```

This performs client generation and Next.js compilation without another migration.
Use either A or B, not two concurrent migration paths. Hostinger-managed hosting may
not offer npm execution over ordinary SSH; use the supported hPanel build mechanism
or a separately approved job, rather than assuming a VPS shell.

### Cutover and checks

1. Ensure the migration is recorded successfully before starting new code, which
   selects new columns. Starting it first would cause missing-column/table errors.
2. Start through the existing Hostinger configuration:

   ```sh
   npm start
   ```

   This runs `next start`, using Hostinger's port. Do not use `npm run dev` in production.
3. Smoke-test customer/admin/vendor sign-in, public products/services, vendor booking
   lists, order/payment read views, catalog creation and moderated service submission.
   Arrange any real transaction or moderation test separately; do not silently alter
   actual customer orders as a deployment check.
4. Compare pre/post data summaries, verify pending listings remain hidden and historical
   booking prices remain unchanged. Confirm provider quotas/errors and application logs.
5. Restore `JORO_DEPLOY_MIGRATIONS=false` for ordinary builds and resume service writes
   only after smoke checks. Updating hPanel environment may itself require a redeploy;
   do not trigger that until approved.

### Rollback

Keep the additive schema and newly created records. If compilation fails after
migration, the database may already be changed even though app cutover failed. Restore
the previous application artifact through the hosting release mechanism, keep service
listing/catalog submissions suspended, and prepare a forward repair. The new pending
default intentionally differs from the old admin workflow. Do not undo it by silently
auto-approving services, run DROP/DELETE SQL, reset the DB, or overwrite newer orders
with an old backup. Record the actual Hostinger artifact/release ID and tested restore
procedure before approving deployment; they are not known from this workspace.

## 8. User/data safety assessment and unresolved blockers

| Item | Readiness |
| --- | --- |
| Prisma generation | Resolved locally; no files deleted |
| Geoapify authentication | Verified HTTP 200; key not logged |
| Dedicated signing secret | Latest local files configured/matching; preserve it across deployments |
| Location correctness | **Blocking:** unsuitable/mismatched live results are admitted |
| Private DB profile | **Blocking:** unexpected runtime variables are refused |
| Production engine/collation/history | **Unverified:** no connection attempted past guards |
| New migration replay and JSON filter semantics on target engine | **Unverified; required before approval** |
| Backup/restore and DDL lock window | **Unverified; required before approval** |
| Immutable release payload | Not yet approved/committed; two safety tests refuse it as designed |
| Existing customer/vendor records and auth secrets | Not modified by this review or migration SQL |
| Products, orders, payments and booking snapshots | No migration writes to those tables; integration safety still requires staging acceptance |
| Existing legacy services | Preserved; verified area filters exclude unverified coverage; update requires review |
| Existing add-ons and standalone quotes | Focused regression tests pass; area-limited add-ons intentionally require a separate area-aware checkout enhancement |
| Shared cancellation/settlement caveats | Prior audit issues remain; no cross-module fix made or implied |
| Hostinger runtime/permissions/binary platform | Not independently inspected; verify before cutover |

No unconditional claim that production is safe is justified yet. The recommended next
approval is for the narrowly scoped geographic suitability correction and local profile
placement correction, followed by staging and read-only production preflight—not for
immediate live migration or deployment.

## Official deployment references

- Hostinger Prisma/build guidance: https://www.hostinger.com/support/how-to-deploy-prisma-apps-on-hostinger-node-js-hosting/
- Hostinger environment settings: https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/
- Hostinger Node hosting workflow: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- Geoapify geocoding filters/types: https://apidocs.geoapify.com/docs/geocoding/
- Geoapify autocomplete: https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/

Only this report and the cross-reference in `SERVICES_MANAGEMENT.md` were added/updated
as project documentation during this review. Business logic, migrations, package files,
private env files and production data were not modified. The temporary provider check
script was removed. Existing uncommitted implementation/AnnouncementBar changes remain.
