# Services management implementation and release checklist

> Current implementation and release limits: [SERVICES_BLOCKERS_REMEDIATION.md](SERVICES_BLOCKERS_REMEDIATION.md).
> Version-2 geographic proofs now use source classification, actual aliases and local
> administrative membership. Older coverage is preserved but requires renewal before
> verified submission/availability. Approved private-profile cleanup is complete.

> Latest production readiness review: [SERVICES_PREDEPLOYMENT_READINESS.md](SERVICES_PREDEPLOYMENT_READINESS.md).
> Prisma generation is now resolved and the configured key was live-tested. Location
> suitability and private DB-profile placement issues currently block production release.
> Earlier validation notes below describe the implementation-time state.

## Scope and architecture

This extends the existing `/admin/services`, vendor Services, public Services and
service booking APIs. It does not introduce another marketplace or change Wants,
private offers, cart, Orders/payment processing, commission calculations or auth.
The existing service add-on resolver has one directly relevant availability guard.
The earlier AnnouncementBar changes are separate and were preserved.

Admin tabs: Overview, Service Catalog, Pending Approvals, All Vendor Services,
Service Bookings. Catalog entries alone are never customer listings. A listing
requires an existing approved vendor; vendor/catalog uniqueness is database-enforced.
`moderation.manage` controls catalog, listing creation and moderation. Booking reads
require `orders.view`; booking admin mutations require `orders.manage`. The existing
RBAC helper verifies the admin account and records listing/catalog audit events.

New vendor listings are `PENDING_APPROVAL`. Approved/rejected/pending listings can
be edited by their owner. Content, price, type and coverage saves hide the listing
until approval. Rejected listings can be corrected and resubmitted. `HIDDEN` listings
require admin intervention. Availability-only changes on approved listings do not
change moderation. Hide/restore/approve/reject preserve vendor availability.
Review and edit requests carry an `updatedAt` version; stale reviews fail with 409.
Admin can explicitly save/publish an existing listing or create/publish one for an
approved vendor. Every administrative listing/catalog operation is audited.

Catalog prices are defaults. Vendor prices and price types are stored on the listing;
neither catalog edits nor moderation rewrite purchased booking snapshots. Both price
types are allowed for vendors. Disabling a catalog entry prevents new selections and
approval against it; existing approved listings retain their prior published terms.

## Geographic provider and configuration

The existing GeoNames city list (`data/PAKISTAN-CITIES.md`) remains in unrelated forms.
It has no neighborhood hierarchy and accepts arbitrary legacy text, so it is not an
authority for service coverage.

Services use Geoapify Address Autocomplete, called only from the server. There is no
Nominatim autocomplete, scraping, shipped neighborhood list or synthetic fallback.

1. Create an account at https://myprojects.geoapify.com/ and create a project/API key.
2. Configure the following in `.env.local` for normal local Next.js development, or
   your deployment's **server environment** for production. Do not commit real keys:

   ```dotenv
   GEOAPIFY_API_KEY=your-private-geoapify-project-key
   SERVICE_LOCATION_SECRET=your-long-random-stable-signing-secret
   SERVICE_LOCATION_DAILY_LIMIT=2500
   ```

3. Restart the application. Never prefix these values with `NEXT_PUBLIC_`.
4. If omitted, `SERVICE_LOCATION_SECRET` falls back to the existing `NEXTAUTH_SECRET`.
   Keep the signing secret stable: rotating it invalidates saved location attestations
   for future edits/filter submissions, so selections must then be reverified.
5. Check your Geoapify dashboard's quotas and configure provider-side restrictions
   appropriate to server-side requests and your plan. Do not restrict to a browser
   referrer if that prevents the server proxy from working.

Official references:

- https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/
- https://apidocs.geoapify.com/docs/geocoding/ (country and city-boundary filters)
- https://www.geoapify.com/pricing/
- https://www.geoapify.com/terms-and-conditions/
- https://www.openstreetmap.org/copyright

At inspection, the published free tier lists 3,000 credits/day and 5 requests/second;
confirm current plan terms before release. The proxy uses 400ms input debounce,
per-IP throttling, 15-minute autocomplete and 24-hour metadata caches, upstream pacing
about 300ms apart and a configurable 2,500-credit daily ceiling **per process**.
Names enrichment consumes an additional credit. Multi-instance deployments
need an aggregate quota/rate limit at the gateway/provider; process limits are not a
cluster-wide quota. Failed requests are not cached. Timeout/provider errors fail
closed and do not erase selected coverage.

Attribution links to Geoapify and OpenStreetMap are rendered beside location search.
Geoapify uses open geographic sources; OpenStreetMap data is ODbL. Review the applicable
plan and data-source licensing if exporting/redistributing a derived geographic dataset.

### Accuracy and limitations

- City search is country-filtered to `pk`; returned provider place IDs and full labels
  distinguish ambiguous names. Aliases resolve through the provider, not a local
  invented spelling table.
- Area search coordinates rank candidates only. Place Details verifies source type and
  names; Boundaries `part-of` and exact source city association establish geographic
  membership. No point-record bounding box or arbitrary radius is treated as proof.
  Source suburbs/neighborhoods/quarters are supported; amenities, buildings, streets,
  vague administrative districts and uncorroborated results are excluded.
- The server signs the source result, country, canonical place ID, label, type and
  parent-city ID. Submissions and public location filters verify that signature and
  city relationship. Client-provided area names cannot establish coverage.
- Coverage is structured JSON: each city has its own areas and an explicit
  `entireCity` flag. Non-whole-city entries require at least one verified area.
- Provider identifiers describe source records, not an immutable government registry.
  Boundary accuracy and locality completeness depend on source data. There is no
  claim of complete Pakistan-wide locality coverage or verified support for every
  example city before live testing.
- Missing/ambiguous areas stay unavailable. Vendors can submit a separate location
  review request. Admin records an investigation; this never creates a fabricated
  location. Source correction/reverification is required before publishing coverage.
- No Geoapify key was present during initial implementation. Subsequent live geographic
  checks, the revised source verification and remaining production limits are recorded
  in `SERVICES_BLOCKERS_REMEDIATION.md`.

## Compatibility policy

- Existing offerings retain their prior moderation state, prices, categories and
  city strings. `catalogId` and `coverage` are nullable; the migration does not invent
  catalog mappings or assert that legacy city names mean whole-city coverage.
- Legacy listings remain accessible in general browsing/details and are marked
  "areas not verified; confirm availability". They are excluded from canonical
  verified city/area filtering until updated with verified coverage and approved.
- Historical city-only product add-ons retain their existing checkout behavior.
- New verified whole-city add-ons work through the existing city-only checkout.
  For mixed coverage, the add-on endpoint exposes only whole-city options, and the
  resolver independently rejects area-limited cities. Area-limited listings remain
  discoverable and can be requested through the existing general Service Want flow.
  Selling them directly as product add-ons would require a separately scoped cart/
  checkout address-area enhancement; no false whole-city eligibility is assumed.
- Standalone private-quote services remain independent of catalog listings and retain
  existing commission, order, booking, notification and settlement behavior.
- Booking admin APIs now paginate/filter; vendor/customer booking behavior is retained.
- Known shared order-cancellation synchronization and settlement inconsistencies from
  the audit are not changed here. A cross-module fix needs separate review/approval.

## Migration: prepared, NOT applied

`prisma/migrations/20261101000000_service_catalog_coverage/migration.sql` adds the
catalog, nullable listing relationship and verified coverage, review attribution,
location-review requests and indexes. It widens moderation status to 24 characters
and changes its **future insert default** to `PENDING_APPROVAL`; existing values
are unchanged. The new historical submission timestamp is initialized from `createdAt`.
Existing catalog references are NULL, so the vendor/catalog unique
index does not collapse or delete legacy services. No booking or order table changes.

The migration manifest was generated using the repository's pure `buildManifest`
helper, without staging files or invoking database mutations. Static checksum checks
pass. A full replay against MySQL/MariaDB is still required: the local Docker engine
was unavailable. A matching checksum is not proof of SQL execution or schema parity.

### Safe local checks (PowerShell)

Run in `C:\Users\hamid\Pictures\IN-range-by-Abdullah`:

```powershell
npx.cmd prisma validate
node scripts/db-migrations.mjs check
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/service-management.test.ts tests/checkout.test.ts tests/checkout-offers-addresses.test.ts tests/checkout-release-safety.test.ts tests/customer-account.test.ts
node scripts/test-services-management-browser.mjs
npx.cmd tsc --noEmit --incremental false
```

The browser suite uses the existing `playwright-core` and installed Edge. On another
machine set `SERVICES_TEST_BROWSER` to an installed compatible Chromium executable.
It runs real React forms against local HTTP fixtures; it does not prove real API or
database integration. On restricted machines, local browser/build tooling may need
execution permission beyond the sandbox.

Stop your own local Next.js process before `npx.cmd prisma generate` on Windows; it
can lock `query_engine-windows.dll.node`. Do not kill unrelated processes. Generation
updated the generated client/type files here but could not replace the locked DLL,
even outside the sandbox. Complete regeneration after releasing the lock.

For a **new disposable local database only**, first set a dedicated server/database
URL in the current shell. Do not copy the live profile:

```powershell
# Replace these placeholders privately; never use production credentials here.
$env:DATABASE_URL = 'mysql://LOCAL_TEST_USER:LOCAL_TEST_PASSWORD@127.0.0.1:3306/joro_services_test'
node scripts/db-migrations.mjs deploy-preflight
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
npx.cmd prisma migrate diff --from-url "$env:DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
npx.cmd prisma generate
npm.cmd run dev
```

Use an existing local database only after a backup and an explicit identity check.
Do not run `migrate reset`, `db push`, edit applied migration SQL/checksums, or run the
project's auto-staging migration workflow merely to test these prepared migrations.

Build without migration side effects:

```powershell
$env:JORO_DEPLOY_MIGRATIONS = 'false'
$env:JORO_NEXT_DIST_DIR = '.next/services-check'
node node_modules/next/dist/bin/next build
```

For live acceptance after key/database setup: test the example cities across Pakistan;
verify real neighborhoods inside each selected boundary, missing/ambiguous results,
multi-city reload, whole-city filtering, cross-city rejection, admin creation and
moderation, uniqueness conflicts, legacy add-ons and existing standalone quote checkout.

### Production requirements and rollback

No migration, commit, push or deployment was performed. Before any future deployment:

1. Complete disposable-database replay and real provider acceptance checks.
2. Take and verify a restorable production backup; confirm migration history/identity.
3. Provision the private environment variables and provider quota/attribution.
4. In the approved target environment, apply the prepared migration **before** the
   new app starts. Exact database commands after approval and identity verification:

   ```powershell
   node scripts/db-migrations.mjs deploy-preflight
   npx.cmd prisma migrate deploy
   npx.cmd prisma migrate status
   npx.cmd prisma generate
   ```

5. Deploy the reviewed artifact through the existing release process; smoke-test
   catalog, vendor submission, moderation, location filters and existing bookings.

Rollback is application-first: suspend service listing/catalog submissions at your
gateway, restore the previous known-good application artifact through the existing
hosting release mechanism, and keep the additive schema and all new records. Do not
reverse this migration with DROP/DELETE SQL or restore an old whole-database backup
over newer orders. Keep submissions suspended until a forward fix is verified: the
new pending default is intentional and an older admin screen does not implement the
new review workflow. Existing booking data remains preserved. There is no safe
universal artifact rollback shell command without knowing the hosting release ID;
record that ID and the provider's restore procedure before deployment.

If migration fails partway, MySQL DDL may already have committed. Inspect migration
status and actual columns/indexes; prepare a forward repair. Do not blindly retry
the raw SQL, mark it applied, or edit `_prisma_migrations` to conceal partial failure.

## Recorded validation (1 November 2026)

- 51 focused automated tests passed, including the new management API/coverage tests
  and existing checkout, standalone quote fulfillment and customer-account tests.
- Isolated browser checks passed: master catalog creation, default/vendor prices,
  multi-city and city-specific areas, pending submission, admin approval/full details,
  customer filters, provider failures and saved selections. Vendor layouts were
  checked at 320/375/768/1440px; admin at 320/768/1440px. No browser page errors.
- Targeted ESLint passed; TypeScript passed; Prisma schema validation and static
  migration manifest checks passed; `git diff --check` passed.
- Final production Next.js build passed, including type checking and static generation.
  Existing warnings concern Browserslist, Edge `jose` compression APIs and unrelated
  image tags. The build's automatic isolated-directory tsconfig addition was removed;
  no unrelated tsconfig change is included.
- Full Prisma generation remains blocked at DLL replacement by a Windows file lock.
- Live Geoapify and MySQL/MariaDB migration/integration acceptance remain pending.
  No production database access or deployment was performed.

## File inventory

Modified: `prisma/schema.prisma`, `prisma/migration-manifest.json`,
`app/admin/services/page.tsx`, `components/admin/ServiceListings.tsx`,
`app/api/admin/services/route.ts`, `app/api/vendor/services/route.ts`,
`app/vendor/dashboard/services/page.tsx`, `app/api/services/route.ts`,
`app/api/services/bookings/route.ts`, `components/user/ServiceBookings.tsx`,
`app/(user)/services/page.tsx`, `app/(user)/services/[id]/page.tsx`,
`components/user/services/ServiceCard.tsx`, `lib/public-services.ts`,
`app/api/products/[id]/services/route.ts`, `lib/service-checkout-service.ts`.

Added: `lib/service-coverage.ts`, `lib/service-locations.ts`,
`lib/service-management.ts`, `app/api/admin/services/catalog/route.ts`,
`app/api/services/locations/route.ts`, `app/api/services/location-requests/route.ts`,
`components/user/services/ServiceCoverageSelector.tsx`,
`components/user/services/ServiceListingForm.tsx`,
`components/user/services/ServiceLocationFilter.tsx`,
`tests/service-management.test.ts`, `scripts/test-services-management-browser.mjs`,
the migration above and this document.
