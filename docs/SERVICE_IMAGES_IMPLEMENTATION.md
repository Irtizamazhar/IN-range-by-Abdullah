# Services image uploads: implementation and validation

Implemented against the latest local Services code (`02a374e` base). Local implementation and validation are complete. No commit, push, production deployment/restart, database migration or production data change was performed.

## Behavior

- Admin → Services → Service Catalog → Create/Edit has a default-image upload field. Admin-created/edited vendor listings also support a provider-specific image.
- Vendor Dashboard → Services → Add/Edit has a custom-image field. The listing uses its custom image first, the linked catalog default second, and a JORO placeholder last. An image that fails to load falls back through the same hierarchy. Existing inactive catalog defaults remain visible on their existing listings.
- Both fields support upload, preview, replacement, reference removal, edit/reload, progress, success and failure messages. Failed uploads preserve the previous selection. Upload-in-progress blocks saving. Provider selection cannot change during an upload. The form must be saved to persist an uploaded URL; an unsaved upload may remain as an orphan, deliberately retained.
- Replacement generates a new file. Remove clears the database reference when the form saves; it never destroys the original asset. No image is overwritten or deleted.
- All card variants, public listing queries, detail hero, related cards, homepage service cards and admin/vendor management views use the shared image/fallback presentation. The homepage already renders ServiceCard; no unrelated homepage code was edited.
- Responsive 16:10 media containers, center positioning, object-cover and Next.js Image with responsive sizes keep a consistent presentation. The uploader recommends a landscape source. A portrait source is fitted by the same cover behavior; no destructive crop is written to storage.
- Existing pricing, geographic validation, provider approval, moderation transitions, booking snapshots and availability behavior are unchanged. Vendor image edits use the existing resubmission path and remain pending review. Catalog defaults do not replace vendor custom images or vendor prices.

## Storage, validation and authorization

The existing centralized helper has one shared change: `services` was added to its public-folder allowlist. Other upload endpoints, storage policies and private-document guards are unchanged.

New persistent files use:

```text
/uploads/services/catalog/svc-<timestamp>-<uuid>.<jpg|png|webp>
/uploads/services/vendor-<vendorId>/svc-<timestamp>-<uuid>.<jpg|png|webp>
```

In production these map to the existing absolute external `UPLOADS_DIR`, expected `/home/u749284283/joro-uploads`. The production helper fails closed when storage is missing, invalid or inside a release; it never falls back to deployment-managed public/uploads for new writes. Local development retains the helper's prior behavior unless UPLOADS_DIR is configured. Existing `/uploads` secure serving handles the new namespace immediately; no build/restart is needed after each upload.

Endpoints:

| Endpoint | Required authorization | Destination owner |
| --- | --- | --- |
| POST `/api/admin/services/image?kind=catalog` | Existing `moderation.manage` admin permission | `catalog` |
| POST `/api/admin/services/image?kind=listing&vendorId=…` | Same admin permission plus real approved target provider | `vendor-<approved target>` |
| POST `/api/vendor/services/image` | Existing approved-vendor API guard | Vendor ID from server session |

The vendor endpoint ignores any client attempt to choose another vendor/catalog destination. Existing service-record ownership checks execute before image assignment. Saving a changed image checks both namespace ownership and actual file existence in persistent storage (no legacy fallback for newly assigned references). A vendor cannot assign another provider's upload or modify another provider's listing.

Server validation enforces nonempty files, a 5 MiB limit, JPG/PNG/WebP MIME/signatures and actual image decoding with the helper's 40-million-pixel limit. Unsafe names, SVG, private paths, traversal and arbitrary external URLs are rejected. Same-origin checks and the existing upload rate limiter are reused. Storage errors use generic service-image messages without credentials or filesystem paths. Public images are deliberately public; private documents never belong in this uploader.

Existing supported Cloudinary image URLs can still render and remain unchanged when saved unchanged. New uploads use Hostinger; new arbitrary external references cannot be substituted through save requests. No new Cloudinary account, key, environment setting or competing storage system was added.

## Database migration and deployment limits

Neither existing ServiceCatalog nor ServiceOffering had an image field. Two nullable VARCHAR(2048) fields were added:

```text
ServiceCatalog.imageUrl  — admin default
ServiceOffering.imageUrl — provider override
```

Prepared only:

```text
prisma/migrations/20261101010000_service_images/migration.sql
```

It contains two ADD COLUMN statements and no row updates, table recreation, drops or destructive operations. Existing rows remain NULL and use the default/placeholder hierarchy. The local migration manifest was regenerated with the existing manifest builder; all seven previous migration checksums, including `20261101000000_service_catalog_coverage`, are unchanged. That preceding migration file was not edited.

The image migration requires ServiceCatalog to exist. If the earlier Services migration is still pending on the target, it must be separately approved, applied and verified first. This feature must not be deployed against a schema lacking either image column. Schema validation/client generation/build are verified locally; actual SQL application and database round-trip tests on a restored staging database are still required. No live schema state is assumed from local code.

Keep `JORO_DEPLOY_MIGRATIONS=false`. Do not auto-run migrations during a build. Before a later separately approved Services release: back up and test restoration, verify target history, test the ordered additive migrations on staging, validate all Services flows there, then obtain explicit production migration/deployment approval.

The older `.release-prep/image-storage` 25-file candidate was not updated with this work. It remains a distinct image-storage-only candidate. Do not mix this Services schema/feature into that older release manifest.

## Validation

| Check | Result |
| --- | --- |
| Existing full regression suite | 206/206 passed |
| Services/geography + image/storage compatibility suite | 35/35 passed |
| Total automated tests | 241 passed |
| Existing Services browser regression | Passed: catalog, pricing, multi-city/area UI, submissions, approvals, responsive layouts |
| New Services image browser suite | Passed: admin upload/preview/failure/replace/remove/reload, vendor override/remove/default, pending moderation, cards/placeholders, broken custom image and inactive-default fallback |
| Viewports | 320, 390, 768 and 1440px; no page overflow |
| Actual service detail and card rendering tests | Passed, including image selection and existing approval filter |
| Real local upload helper and serving | Valid image bytes saved, immutable replacement retained, immediate HTTP 200, matching bytes |
| Prisma schema validation and Client generation | Passed, 6.19.2 |
| TypeScript | Passed |
| Next lint | Passed with existing unrelated img warnings |
| Final optimized production build | Passed, isolated output, migrations disabled, unused localhost DB port |

API tests exercise the actual handler/helper logic with in-memory auth/Prisma adapters. Browser tests render actual React components with offline HTTP fixtures; they do not modify live records or claim real provider geography tests. The storage tests use disposable local image fixtures and clean up only their own temporary fixtures. Existing original uploads are never cleaned up.

The production build used `node_modules/.cache/joro-service-images-build`. Its temporary tsconfig include was restored. Google Fonts network access was approved for build verification. Existing Browserslist/Edge jose/Prisma configuration warnings remain. Tests and builds did not query the live database.

Reproduce the targeted tests on Windows:

```powershell
$env:TSX_TSCONFIG_PATH = (Resolve-Path tests/tsconfig.json).Path
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/service-images.test.ts tests/service-management.test.ts tests/service-geography.test.ts tests/public-uploads.test.ts tests/cloudinary-storage.test.ts
Remove-Item Env:TSX_TSCONFIG_PATH
npm.cmd test
node node_modules/prisma/build/index.js validate
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run lint
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/test-service-images-browser.mjs
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/test-services-management-browser.mjs
```

The JSX-aware test config already existed; it is needed for the component rendering test. Browser scripts require an installed local Chromium/Chrome/Edge and appropriate local process/filesystem permissions.

Not yet verified: actual Hostinger service uploads, Linux runtime storage permissions/hard-link publication, live save/reload, actual database migration application, and restart/redeployment persistence for service images. Those remain staging/live acceptance checks requiring their applicable approvals. Local success is not a claim of completed production deployment.

## Exact modified/new files

```text
app/(user)/services/[id]/page.tsx
app/api/admin/services/catalog/route.ts
app/api/admin/services/image/route.ts
app/api/vendor/services/image/route.ts
app/vendor/dashboard/services/page.tsx
components/admin/ServiceListings.tsx
components/user/services/ServiceCard.tsx
components/user/services/ServiceImage.tsx
components/user/services/ServiceImageUpload.tsx
components/user/services/ServiceListingForm.tsx
lib/public-services.ts
lib/public-uploads.ts
lib/service-image-policy.ts
lib/service-images.ts
lib/service-management.ts
prisma/schema.prisma
prisma/migration-manifest.json
prisma/migrations/20261101010000_service_images/migration.sql
scripts/test-service-images-browser.mjs
tests/service-images.test.ts
docs/SERVICE_IMAGES_IMPLEMENTATION.md
```

Orders, Payments, Wants, Products, their upload APIs, existing Services pricing/coverage/booking implementation, private configuration, package/lockfile, prior SQL and the old isolated image-only checkout were not edited for this task. No images were deleted. No commit, push, deploy, production restart or database migration was performed.
