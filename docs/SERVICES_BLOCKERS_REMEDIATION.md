# Services readiness blocker remediation

> Latest production read-only verification: [SERVICES_PRODUCTION_READONLY_CHECK.md](SERVICES_PRODUCTION_READONLY_CHECK.md).
> Actual server version/history/schema metadata are now verified. Pre-existing drift,
> staging/backup acceptance and separate migration/deployment approval remain documented there.

Date: 1 November 2026 (Asia/Karachi). This supersedes the initial findings in
`SERVICES_PREDEPLOYMENT_READINESS.md`.

**Production status: HOLD.** Geographic validation and the approved configuration
cleanup are fixed. Staging migration replay, production metadata/history verification,
backup/restore acceptance, API-key rotation and an approved release artifact remain.
No production migration, data modification, commit, push or deployment was performed.

## Geographic validation fixed

Autocomplete now discovers candidates; it does not certify them. The server requires:

1. A Pakistan result whose name/prefix or alias is actually recorded in the detailed
   source names. No fuzzy similarity or invented abbreviation expansion is sufficient.
2. Geoapify Place Details backed by a canonical OpenStreetMap node/way/relation ID.
   Cities must be source cities/towns/villages; localities must be source suburbs,
   neighborhoods or quarters. Divisions, tehsils, businesses and buildings are excluded.
3. Geoapify Boundaries `part-of` evidence for local administrative membership (levels
   6–10). Country/province overlap alone is insufficient.
4. For an area, either membership in the selected city's exact source boundary ID,
   or BOTH the source's exact city association and a matching local administrative
   containment ID. Differing metropolitan labels are not silently equated.
5. A version-2 HMAC attestation binding names, canonical source ID, parent city,
   provider reference, coordinates and membership evidence. Client edits to these
   claims cannot establish verified coverage. Unresolvable same-name ambiguity is withheld.

Canonical application IDs now use `osm:n:<id>`, `osm:w:<id>` or `osm:r:<id>`; opaque
Geoapify references remain separate. This prevents language/centroid encodings of one
source record from becoming different application locations.

### Why autocomplete and city filters alone were insufficient

The source Lahore city record is a point, not a complete municipal polygon, even
when full geometry is requested. A provider `place` filter for that record is not
adequate containment proof and may exclude legitimate nearby candidates. New city
coordinates are used only for candidate ranking, never as a radius/bbox proof.
Detailed source classification, actual names, and `part-of` membership decide acceptance.

Where an exact city boundary is unavailable, the method verifies provider city
association inside a validated local administrative envelope. It does not certify
legal municipal footprints or full Pakistan-wide neighborhood coverage. Unsupported,
missing or contradictory evidence fails closed. Existing location-review requests
remain available; marking a request reviewed never creates geographic proof.

Metadata is cached up to 24 hours and autocomplete for 15 minutes. All provider
endpoints share in-flight deduplication, pacing about 300ms apart and a daily credit
ceiling (default 2500/process). Names enrichment consumes an extra credit. Multi-instance
deployments still need aggregate provider/gateway quotas. The UI retains 400ms debounce,
loading/error states, attribution and saved selections during failures.

Official contracts:

- https://apidocs.geoapify.com/docs/place-details/
- https://apidocs.geoapify.com/docs/boundaries/
- https://apidocs.geoapify.com/docs/geocoding/

## Live geographic results

The configured server-side key was accepted and the revised helper issued/checks
version-2 signatures. No credentials, private URLs or signed tokens were printed.

| Query / selected city | Result |
| --- | --- |
| Lahore | Verified Lahore and the separately classified Lahore Cant town |
| Johar Town / Lahore | Verified Johar Town; Johar Avenue/View rejected as query mismatches |
| DHA / Lahore | No verified result; Walled City of Lahore rejected |
| Gulberg / Lahore | Withheld instead of silently adopting a conflicting source city |
| Gulberg / Lahore Cant | Withheld where candidate/source evidence cannot be resolved safely |
| Islamabad, Rawalpindi, Karachi, Faisalabad, Peshawar, Multan, Sialkot, Abbottabad, Swabi | City-source candidates available in the nationwide pass; administrative divisions excluded |
| Wah Cantt | Unsupported abbreviation: no corroborated source alias found |
| Wah Cantonment | Verified canonical town record available |

Same-name villages can appear with their actual kind and full address; they are not
silently merged with a larger city. Empty results mean unsupported verification, not
that the real location does not exist. Source completeness remains an external limit.

Run read-only checks (these consume provider credits):

```powershell
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/check-services-geography.mjs --quick
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/check-services-geography.mjs
```

The quick check also attempts to reuse Lahore's Johar Town under Rawalpindi and rejects
that source identity under the wrong parent.

## Saved coverage and compatibility

No saved database coverage was deleted or rewritten. Version-1 structured selections
remain readable but are marked for verification renewal. Their old signature only
proved issuance under the weaker rules; they cannot be submitted, approved/restored
as verified structured coverage, or used for canonical verified availability until
reselected. The selector explains this and preserves the original entries.

New submissions, multiple cities/areas, vendor resubmission and admin creation remain
on the existing APIs. Admin approval now checks geographic proof again. Public city/
area predicates require v2 proof and the correct city-source identity.

Historical city-only listings with `coverage=NULL` retain their existing add-on
contract. Older structured coverage needs renewal before new add-on purchases. No
booking/order snapshots, prices, payment states or records are changed. Existing
general Service Wants/private offers are preserved; this is not targeted booking.

## Environment cleanup and rotation

The user explicitly approved removing ONLY `GEOAPIFY_API_KEY` and
`SERVICE_LOCATION_SECRET` from database-only `.env.live.local`. Matching nonempty
runtime copies were verified first. All unrelated lines/settings and database/tunnel
credentials were preserved byte-for-byte. `.env` was not modified. `readConfig` now
passes without a database connection.

Current runtime requirements, values withheld:

| Name | Requirement/status |
| --- | --- |
| `GEOAPIFY_API_KEY` | Configured and accepted by live server-side requests |
| `SERVICE_LOCATION_SECRET` | Configured, at least 32 characters, distinct from API/auth secrets; minimum now enforced |
| `SERVICE_LOCATION_DAILY_LIMIT` | Optional positive integer; unset means 2500 credits/process |
| `DATABASE_URL` | Existing correct Hostinger runtime target; do not copy local development URL |
| `NEXTAUTH_SECRET`, `VENDOR_JWT_SECRET` | Preserve existing production values to protect existing sessions |
| `NEXTAUTH_URL` | Use the canonical production HTTPS origin; local value is not that origin |
| `JORO_DEPLOY_MIGRATIONS` | False normally; true only during an approved migration release |
| `NPM_CONFIG_INCLUDE` | `dev` during build where needed to retain the Prisma CLI/build tools |

Next.js does not load `.env.live.local` automatically. Runtime secrets belong in
normal local environment files and Hostinger's server environment, never `NEXT_PUBLIC_`.
Keep the signing secret stable across instances/releases. Character count alone does
not prove cryptographic randomness.

**Exposed API-key rotation still required before production:** create a replacement
in Geoapify, provision it privately in local/runtime and hPanel settings, restart in
the approved environment, verify the replacement with read-only checks, then revoke
the exposed old key and review usage. Do not paste it into chat. API-key rotation does
not require rotating the independent signing/authentication secrets. No remote key
rotation or production configuration change was performed automatically.

## Two deployment-safety test failures resolved without a guard bypass

The old tests treated the developer's dirty working tree as a committed release.
They now construct an isolated HEAD snapshot from existing Git objects only, exercise
`repositoryState(snapshot,true)`, then dirty the snapshot and assert refusal. No commit,
staging, index change or production tool modification is performed. Optional Git locks
are disabled only while the read-only fixture is checked.

The real command `node scripts/db-live.mjs check` was attempted after the profile
cleanup. Its unchanged committed-payload guard refused this intentionally uncommitted
working tree before any production connection. Passing isolated tests does not authorize
deployment of this working tree.

## Prisma and migration readiness

Prisma Client generation was resolved previously (6.19.2). This remediation does not
upgrade dependencies, edit Prisma schema or modify migration SQL. Stop only this
project's dev server before regeneration if Windows holds its DLL. Generate the Linux
client on Hostinger; do not upload Windows node_modules or engine DLLs.

The one prepared Services migration remains:
`prisma/migrations/20261101000000_service_catalog_coverage/migration.sql`.
All seven active migration checksums/schema checks pass. Its operations remain:

- Add catalog and location-request tables, nullable catalog/coverage and review metadata.
- Widen status/default future inserts to pending; preserve existing statuses/prices.
- Add indexes, vendor/catalog uniqueness and a restrictive FK; NULL legacy IDs remain valid.
- Backfill only the new `submittedAt` from existing `createdAt`.

No migration writes to customer, vendor, product, order, booking, payment, inventory or
earnings tables, and no DROP/DELETE/reset is included. New geographic proofs fit the
existing JSON column; no additional migration was needed.

Static SQL matches baseline lowercase mappings, JSON/timestamps and utf8mb4_unicode_ci.
Actual production engine/version, row format, collation, privileges, key limits, free
disk, drift and migration history remain unverified. MySQL DDL may partially commit;
ALTER/index creation and the backfill may lock data. No production guard was bypassed.

Required staging/backup checks before approval:

1. Obtain a production-like disposable database and verify target identity/version.
2. Restore a verified backup into staging; prove it is usable. Record private row,
   status and financial summaries before migration.
3. Apply only the reviewed migration to staging, after checking its exact pending list.
4. Diff against Prisma and test NULL legacy records, indexes/FK/uniqueness, MySQL JSON
   area filters, new submissions/approval and existing checkout/bookings.
5. Compare pre/post summaries and measure DDL/backfill duration and locks.
6. Rehearse application rollback and a forward repair after partial DDL failure.

Once an approved immutable release exists, guarded production read-only checks must
verify server version, identity, engine/row format, live columns/collations/indexes and
authentic migration history. Do not run resets, history repairs or a baseline replay.

## Validation commands and scope

Final results for this remediation:

- **78 automated tests passed, zero failures/skips**, including both previously failing
  deployment-safety tests and an explicit dirty-payload rejection assertion.
- Targeted ESLint, TypeScript, Prisma schema validation, migration manifest checks and
  `git diff --check` passed.
- Final isolated Next.js production compilation passed (107 static pages generated).
- Responsive fixture-browser suite passed at the widths below, with no page errors.
- Final live quick acceptance completed **10 searches**, including Johar Town accepted
  for Lahore and withheld for Rawalpindi, unsafe DHA results withheld, and the canonical
  Wah Cantonment result accepted. The earlier nationwide pass covered the city examples
  above; provider coverage completeness and real database integration remain unclaimed.
- The approved private-profile cleanup passed its byte/settings preservation checks;
  actual live DB checking still refuses the uncommitted payload before connecting.

```powershell
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/service-management.test.ts tests/service-geography.test.ts tests/checkout.test.ts tests/checkout-offers-addresses.test.ts tests/checkout-release-safety.test.ts tests/customer-account.test.ts tests/build-steps.test.ts tests/db-live-safety.test.mjs
npx.cmd prisma validate
node scripts/db-migrations.mjs check
npx.cmd tsc --noEmit --incremental false
node scripts/test-services-management-browser.mjs
```

The focused suite covers source classification/name matching, cross-city containment,
multi-city/area proofs, tampering, old-selection quarantine, vendor/admin permissions,
submission/approval, public filtering, existing bookings/checkout and unchanged release
guards. Browser tests run real React components against local HTTP fixtures, covering
catalog, default/custom prices, coverage, pending submission, approval/details, customer
filters and provider failures. They do not replace a real database integration test.
Layouts are checked at 320/375/768/1440px (admin 320/768/1440px).

Targeted lint and isolated production compilation are run too. Existing unrelated
Browserslist, Edge jose and image warnings are not suppressed by modifying unrelated
code. Automatic isolated-build tsconfig entries are removed only if no independent
configuration edit is detected.

## Safe future Hostinger sequence — approval required

Do not run production steps now.

1. Complete staging/backup/restore and production read-only metadata/history checks.
   Rotate the exposed key and accept the documented unsupported-location behavior.
2. Approve an immutable source release through the existing workflow. No commit/push
   is authorized here. Preserve production auth/payment/email/OAuth/upload settings.
3. Provision runtime variables in hPanel, choose a tested Node version and retain
   dev dependencies during build (`NPM_CONFIG_INCLUDE=dev`). Verify installation logs:

   ```sh
   npm ci --include=dev
   ```

4. Freeze service listing/catalog writes for the migration/cutover window. Keep order
   and payment processing outside this change unless a separate maintenance plan is approved.
5. Set `JORO_DEPLOY_MIGRATIONS=true` only for the approved migration build, then use:

   ```sh
   npm run build
   ```

   The existing wrapper runs exactly, stopping on any failure:

   ```sh
   node scripts/db-migrations.mjs deploy-preflight
   node node_modules/prisma/build/index.js migrate deploy
   node node_modules/prisma/build/index.js migrate status
   node node_modules/prisma/build/index.js generate
   node node_modules/next/dist/bin/next build
   ```

   It applies ALL pending active migrations, so the pre-approved pending list must
   contain only intended migrations. Do not run concurrent migration paths. Equivalent
   existing script where selectable: `npm run build:deploy`. If a separately approved
   job applies migrations, use `JORO_DEPLOY_MIGRATIONS=false` for the following app build.
6. Start only after successful schema and application checks:

   ```sh
   npm start
   ```

   This is Next production mode using Hostinger's assigned port, not `npm run dev`.
   Managed hosting may not offer npm over ordinary SSH; use its supported build mechanism.
7. Smoke-test sign-in, listings, verified filters, pending visibility and existing
   booking/order/payment views. Compare private pre/post summaries. Arrange any real
   write/transaction smoke test explicitly instead of altering customer records silently.
8. Restore `JORO_DEPLOY_MIGRATIONS=false` for ordinary builds and resume service writes
   only after acceptance. hPanel environment edits may require an approved redeploy.

If build fails after DDL, keep the additive schema and all records. Restore the prior
application artifact, keep service submissions suspended and prepare a forward repair.
Do not auto-approve rows, DROP/reset tables, conceal partial migration history, or restore
an old backup over newer production orders. Record the real Hostinger artifact ID and
tested restore procedure before deployment.

Hostinger references:
- https://www.hostinger.com/support/how-to-deploy-prisma-apps-on-hostinger-node-js-hosting/
- https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/

## Files changed in this remediation

- `lib/service-geography.ts` (new), `lib/service-locations.ts`, `lib/service-coverage.ts`.
- `lib/public-services.ts`, `app/api/admin/services/route.ts`.
- `components/user/services/ServiceCoverageSelector.tsx`.
- `tests/service-geography.test.ts` (new), `tests/service-management.test.ts`,
  `tests/db-live-safety.test.mjs`.
- `scripts/check-services-geography.mjs` (new), `scripts/test-services-management-browser.mjs`.
- This report, `docs/SERVICES_PREDEPLOYMENT_READINESS.md`, `docs/SERVICES_MANAGEMENT.md`.
- Ignored private `.env.live.local`: only the explicitly approved two-entry cleanup.

No application auth/payment/order code, packages or migrations were changed by this task.
