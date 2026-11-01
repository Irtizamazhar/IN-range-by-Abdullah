# Cloudinary public image storage — implementation and release audit

**Superseded architecture:** the final selection is Hostinger `UPLOADS_DIR`. Use [PUBLIC_UPLOADS_READINESS.md](PUBLIC_UPLOADS_READINESS.md) for the current implementation and exact release manifest. The Cloudinary helper and reference reader remain for compatibility; the public upload handlers no longer default to Cloudinary. The remainder of this document records the earlier implementation and must not be used as the current deployment checklist.

Status: implemented locally; not deployed. Live acceptance is pending credentials and staging tests.

## Cause and architecture

The previous public upload handlers wrote to `process.cwd()/public/uploads`. That directory belongs to the application release and is not durable storage. Next.js static public-file handling also makes runtime-created files unsuitable as the permanent serving architecture.

All new public image uploads now use the existing signed server-side Cloudinary SDK helper. No public image upload has a disk fallback. Public images have unique UUID public IDs under `joro/`, image-only delivery, JPG/PNG/WebP allowlists and `overwrite:false`. Provider errors return generic errors without credentials or server paths. Existing authentication, permissions, vendor approval, review purchase eligibility, customer sessions, upload rate limits and route-specific byte/size validation remain in place.

| Endpoint | Public images | Cloudinary namespace |
| --- | --- | --- |
| `/api/upload`, `categories-local` | Category | `joro/categories` |
| `/api/upload`, `products-local` | Local product/new arrival | `joro/products` |
| `/api/upload`, `promotions-local` | Promotions | `joro/promotions` |
| `/api/upload`, `inrange-wants` | Customer Wants | `joro/wants/<customerId>` |
| `/api/upload`, default/admin product | Admin product editor | `joro/products` |
| `/api/vendor/upload` | Vendor products, store logos and banners | `joro/vendor-products/<vendorId>` |
| `/api/reviews/photo` | Purchase-verified reviews | `joro/reviews/<customerId>` |

Customer Wants and reviews accept the new URL shape as well as their legacy local references. New Cloudinary references must resolve through the authenticated Cloudinary resource API in the configured account, within the signed-in customer's namespace. Validation never fetches arbitrary user-provided URLs. URL predicates reject other hosts, raw/document resources, traversal, transformations and query strings. Resource verification failure prevents saving the new reference; it does not silently accept an unverified URL. This requires Cloudinary Admin API read access/quota as well as upload access.

Ordinary category/vendor/store/promotion/Want/review records store the returned HTTPS URL in existing fields. Admin products retain the existing `imageIds` editor/attachment authorization protocol. For NEW ProductImage rows only, `data` stores UTF-8 URL text (not an image binary), with discriminator `application/x-joro-cloudinary-reference`. `/api/image/<id>` preserves its existing access checks and redirects these rows to Cloudinary. Existing binary ProductImage rows still return their original bytes. This compatibility representation needs no database schema change or migration.

Replacement always uploads a new asset; existing references are replaced only when the existing form saves successfully. Unsaved uploads can be orphaned. Removing a reference does not destroy Cloudinary assets. Want deletion no longer unlinks historical disk files. A separately approved, reference-aware orphan audit is required before any physical deletion. Public Cloudinary URLs are public even if subsequently removed from the application; do not use this system for sensitive material.

Private payment proofs, vendor identity/appeal documents and support attachments retain their existing private storage and authorization. They are not sent to public Cloudinary delivery. Private local-document durability is a separate concern and has not been claimed fixed here.

## Configuration

Required server-side variables, using the existing account:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
JORO_DEPLOY_MIGRATIONS=false
```

All three Cloudinary values were **missing** when checked through Next.js local environment loading on 2026-11-01. No values were displayed or changed. Hostinger variable presence cannot be verified from this machine without dashboard/server access; confirm all three in the Node.js application's environment settings. Earlier Geoapify configuration does not configure Cloudinary.

Get the existing product environment's credentials from Cloudinary Console > Settings > API Keys. Use server-only variables, never `NEXT_PUBLIC_*`. Signed server uploads require no unsigned preset, browser API secret or new storage account. Confirm account storage/bandwidth limits, image upload permission, resource-read access and any account moderation/access restrictions before release. No paid plan or new provider was provisioned. Missing credentials fail the upload instead of creating an ephemeral local file.

The existing Next.js `res.cloudinary.com` image allowlist already supports previews/rendering; no rewrite or `UPLOADS_DIR` is required for new images.

Cloudinary SDK reference: https://cloudinary.com/documentation/node_image_and_video_upload and https://cloudinary.com/documentation/image_upload_api_reference . Provider assets are delivered separately from Hostinger, but actual persistence acceptance still requires the tests below.

## Validation evidence and limits

- Prisma Client 6.19.2 generation: passed in the production build.
- TypeScript `tsc --noEmit`: passed.
- Next lint: passed with existing unrelated `<img>` warnings.
- Optimized Next.js production build: passed, including page generation. Build output isolated under `node_modules/.cache/joro-cloudinary-build`; original tsconfig restored. `JORO_DEPLOY_MIGRATIONS=false`; DATABASE_URL overridden to an unused local port. No live database used.
- Initial sandbox build failed fetching the existing Google Font; retry with approved network access passed. Existing Browserslist/Edge jose warnings remain.
- Automated Cloudinary tests use a mocked SDK, not real credentials. They verify strict URLs, owner namespaces, missing-credential failure, immutable replacements, remote resource verification, reference-only removal, repeated saved-image-ID requests and legacy binary serving. Existing review, upload-origin, Wants, checkout and build-safety regression tests are included in the reported test command.
- Final results: the existing full `npm test` suite passed **206/206**; the separate new Cloudinary suite passed **4/4**. The initial new-suite fixture and Prisma delegate mocking issues were corrected; no production database was contacted by these tests.
- Browser preview, actual Cloudinary HTTP 200, real database save/reload, actual image replacement/deletion, cross-deployment access and production restart/redeployment tests: **pending**, not claimed successful.
- Production old-file inventory/recovery: not performed; SSH unavailable. 104 historical paths are tracked under `public/uploads` locally; this is not proof that they match every production database reference or contain every missing original.

Run the relevant suite:

```powershell
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/cloudinary-storage.test.ts tests/reviews-ratings.test.ts tests/upload-origin.test.ts tests/wants-social.test.ts tests/wants-feed.test.ts tests/checkout.test.ts tests/build-steps.test.ts
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run lint
```

## Exact image-only file manifest

Only the following paths belong to this change:

```text
.gitignore
app/api/image/[id]/route.ts
app/api/reviews/photo/route.ts
app/api/reviews/route.ts
app/api/upload/route.ts
app/api/vendor/upload/route.ts
app/api/wants/[id]/route.ts
app/api/wants/route.ts
lib/cloudinary.ts
lib/cloudinary-policy.ts
lib/cloudinary-client-upload.ts
lib/review-policy.ts
lib/want-photo-file.ts
lib/want-schema.ts
tests/cloudinary-storage.test.ts
docs/CLOUDINARY_IMAGE_STORAGE.md
docs/CLOUDINARY_HISTORICAL_RECOVERY.md
```

The `.gitignore` addition prevents future untracked runtime files from blanket staging. Already tracked historical media is preserved. No environment files, package files, Prisma schema, migration files, Services files, checkout or payment implementation files were changed for this task. Current working branch: `main`; pre-existing uncommitted Services and Welcome-strip work remain in place.

## Image-only release procedure — requires later approval

Do not deploy this dirty working directory. Do not stage everything. Do not merge the Services implementation into this release.

1. Confirm the precise commit currently running on Hostinger. Local HEAD was `5eab8fe` at the preceding pull; do not assume this equals the live deployment. Record the full verified production base hash.
2. After approval to prepare the release checkout, create a separate worktree from that verified base, without resetting this checkout:

   ```powershell
   git worktree add -b fix/cloudinary-public-images ../joro-image-release <VERIFIED_PRODUCTION_BASE_SHA>
   ```

3. Copy only the exact manifest paths above into that checkout, preserving directory names (use `-LiteralPath` for bracketed routes). Do not copy `.env*`, Services files, Prisma files or the existing build output. If the production base differs from this checkout's HEAD, review each image diff against that base instead of blindly replacing changed files.
4. In the release worktree, inspect `git diff --name-only` and `git status --short`; they must contain only the manifest. Confirm `git diff --exit-code -- prisma` is clean, and that the pending `20261101000000_service_catalog_coverage` migration is absent from the release. Generate Prisma Client from the RELEASE schema, not the dirty Services schema. Install from its unchanged lockfile and run the suite, TypeScript, lint and production build there. The combined working-tree build above is not a substitute for this final isolated-release check.
5. Configure the three Cloudinary variables in staging and confirm `JORO_DEPLOY_MIGRATIONS=false`. Run `npm run build` (never `build:deploy`). No schema migration is required for this image fix.
6. With an approved disposable account/data fixture, upload one image through each relevant role/form. Verify provider asset namespace, HTTPS HTTP 200, preview, saved record, reload and new browser session. For admin products verify both the returned URL and `/api/image/<id>` after save/reload. Confirm wrong-customer review/Want references are rejected, and authorization failures cause no upload.
7. Replace an image and save; verify the new URL changes and the previous asset is retained. Remove it in the application; verify its reference is removed and no provider/disk destruction occurs. Test failed uploads and failed form saves. Check private document URLs still require authorization.
8. Record Cloudinary public IDs, URLs and downloaded SHA-256 checksums. Stop/restart staging and redeploy the same image-only release with the same account configuration. Verify direct Cloudinary HTTP 200/checksum and application pages again. This must pass before declaring deployment persistence verified.
9. Request separate approval for the reviewed image-only commit/push and production deployment. Keep automatic migrations disabled. Preserve all available historical files during release switching; this release does not recover missing originals.
10. Retest on production after the approved release. Rollback must retain the new reference-aware `/api/image/<id>` reader: an older reader treats URL bytes as image content. Record a compatibility rollback build or forward fix before release. No database restore or schema rollback is needed.

No commit, push, deployment, migration, live record update, provider asset deletion or production configuration change was performed during implementation.
