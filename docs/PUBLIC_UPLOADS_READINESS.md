# Hostinger persistent public images — implementation and acceptance report

For the prepared isolated checkout, final file allowlist and approval-gated Git/deployment commands, use [IMAGE_STORAGE_RELEASE_PLAN.md](IMAGE_STORAGE_RELEASE_PLAN.md) and [IMAGE_STORAGE_RELEASE_MANIFEST.json](IMAGE_STORAGE_RELEASE_MANIFEST.json). That final manifest excludes the obsolete Cloudinary proposal documents listed in the historical manifest below.

## Current decision and status

Implemented locally with `UPLOADS_DIR` as the filesystem destination for all public upload endpoints. No production deployment, restart, database write, migration, image recovery or production file copy was performed.

The user supplied SSH evidence for `/home/u749284283/joro-uploads`: owner `u749284283`, permissions `drwxr-xr-x`, and an SSH-user write check. The user reports Hostinger `UPLOADS_DIR` is configured. This establishes the supplied directory evidence, **not** verified access from the running Node.js process or a Hostinger persistence guarantee. Our read-only SSH retry still failed authentication. Production runtime access, actual upload and restart/redeployment persistence remain pending.

No new Cloudinary credentials are required for filesystem uploads. Existing Cloudinary URLs, the Cloudinary helper and its compatibility reader remain intact. No database schema change is required.

## Implementation

`lib/public-uploads.ts` centralizes production root validation, image decoding, immutable filenames, exclusive publication, safe image reads and Node-process permission inspection.

- In production, `UPLOADS_DIR` must be absolute, already exist, resolve to a directory and sit outside the current application tree. An ancestor of the application tree is also rejected. Resolved roots under `hbuilds`, `.next`, `public`, `tmp` or `temp` are rejected. An unavailable root never falls back for writes.
- Development without `UPLOADS_DIR` retains the existing local `public/uploads` behavior. Setting `UPLOADS_DIR` in development permits an isolated test root. No private environment file was edited.
- Public namespace allowlist: `categories`, `products`, `promotions`, `vendor-products`, `wants`, `reviews`. Only plain safe filename components and JPG/PNG/WebP extensions are accepted. No private document/support/payment namespaces, SVG, scripts, encoded traversal or arbitrary file paths are exposed.
- Existing endpoint authentication/permissions, vendor approval, review purchase eligibility, session checks, limits and MIME/signature checks remain. The helper additionally decodes images with Sharp, rejects malformed files, caps size at 8 MiB and input dimensions at 40 million pixels. Existing guest/vendor/review 5 MiB limits still apply.
- New UUID filenames never overwrite old ones. Complete bytes are written and synced to an exclusive temporary file, then published by a same-filesystem exclusive hard link. Only this operation's temporary file is removed. Child symlinks are rejected; reads also use `O_NOFOLLOW` where supported. The root and parent directories must remain controlled by trusted hosting/application users. Hostinger hard-link support must be confirmed by the approved real upload test; errors fail the upload rather than weakening publication safety.
- `/uploads/:path*` uses a **beforeFiles** rewrite to `/api/uploads/:path*`. This takes precedence over static public files, including private directories accidentally left under `public/uploads`. Dynamic Node.js serving reads immediately after upload, without a rebuild or restart. HTTP responses set an image MIME, nosniff, restrictive CSP and revalidation; API errors do not disclose server paths.
- Reads prefer persistent storage, then fall back to an available matching legacy `public/uploads` file. Only missing files trigger fallback; corrupt or unsafe target files are not silently replaced. Existing `/uploads/...` URLs are unchanged. Originals are not moved, renamed or deleted.
- Wants now use `/uploads/wants/<customerId>/want-...` and validate owner and stored-file existence. Legacy flat Want paths remain accepted when the original file exists. Review URLs retain their existing customer-scoped pattern. Existing Cloudinary references retain their account/ownership validation.
- Category, vendor/store, Want, review and promotion records use the existing URL fields. Admin product editors retain their existing image ID/attachment checks. New ProductImage rows store UTF-8 `/uploads/...` reference text in the existing data field with discriminator `application/x-joro-public-upload-reference`; no new image binary is stored there. `/api/image/<id>` preserves access checks and redirects these rows to the stable URL. Historical binary images and earlier Cloudinary reference rows remain readable.
- Replacement creates a new filename. Logical removal does not delete old filesystem or Cloudinary assets; physical orphan cleanup is separately approved work. Failed form saves may leave retained orphan uploads.
- Private payment proofs, vendor identity/appeal documents and support attachments retain their existing private storage and authorization. This change does not claim to fix durability of private local files.

## Configuration and runtime verification

```text
UPLOADS_DIR=/home/u749284283/joro-uploads
JORO_DEPLOY_MIGRATIONS=false
```

Set these in the Hostinger Node.js runtime environment. Do not place the upload root inside a release, change its ownership blindly, or grant world-write permission. Back up this directory separately from application releases. Confirm with Hostinger that it remains mounted and accessible across deployment/container switches for this specific plan.

After an approved image-only deployment, an administrator with `catalog.manage` can GET `/api/admin/uploads/storage`. It performs **read-only checks inside the actual application process**, returning configured/accessibility/external-root flags and process UID, never filesystem paths or secrets. A successful response confirms root read/write/traversal permission checks for that process, not actual file creation, hard-link support or persistence. It deliberately returns `persistenceVerified:false`. Non-admin access is protected by existing RBAC.

Next perform the separately approved disposable upload through a real authenticated upload endpoint. Success must include verifying the file from that actual runtime, HTTP 200, checksum and the restart/redeployment checks below. An SSH-user `test -w` alone does not satisfy acceptance.

## Validation results

Passed locally:

- Existing full regression suite: **206/206 passed**, including checkout, payments, ownership, review, Wants, migration-safety and build-safety tests. An existing arbitrary Want-subfolder rejection remains enforced; only generated customer-scoped Want filenames are newly accepted.
- 13 storage/Cloudinary compatibility tests (9 filesystem tests including their parent, 4 Cloudinary tests).
- TypeScript `tsc --noEmit`.
- Next lint with existing unrelated `<img>` warnings only.
- Optimized Next.js production build and Prisma Client 6.19.2 generation. Isolated build directory: `node_modules/.cache/joro-persistent-build`; tsconfig restored afterward. Automatic migrations disabled; DATABASE_URL set to an unused localhost port, not production.
- Real local Next.js **production HTTP** test using two separate release directories and the same external-to-release storage root. The first process was stopped, then the second release process started. New and legacy URLs returned 200; images written after startup also returned 200 immediately; a test `public/uploads/vendor-docs/private.png` returned 404. SHA-256 was unchanged across release switch: `6af86114db4f7b492aa67dd78f2a0afbe1b7a30a19dda3b349f3e978fb037813`. These were disposable local fixtures, not live Hostinger tests. No real user data or production DB was used.
- Migration tests: default dry-run leaves target unchanged; explicit copy verifies checksums; repeated copies preserve identical files; conflicting targets and sources are retained without overwrite. Child symlinks, malformed/oversize images and unsafe paths are rejected.

Commands:

```powershell
npm.cmd test
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/public-uploads.test.ts tests/cloudinary-storage.test.ts
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run lint
node --require ./scripts/test-userinfo-fallback.cjs --import tsx scripts/test-public-uploads-http.mjs
```

The HTTP script requires the named isolated build and copies its runtime artifacts into disposable local releases. It does not invoke a build, migration, production restart or deployment. Generated fixtures are removed after testing. Existing Browserslist, Prisma configuration deprecation and Edge jose build warnings remain.

Not verified: actual Hostinger Node access, live upload/save/preview/reload, Hostinger filesystem hard-link capability, provider storage durability guarantee, production restart/redeploy persistence, complete historical production reference/file inventory. Live acceptance remains **HOLD** until these are resolved. Local release-switch evidence must not be described as a Hostinger redeployment test.

## Safe historical recovery utility

`scripts/uploads-migrate.mjs` requires explicit existing absolute source and target roots. It defaults to read-only dry-run and accepts only the six public image namespaces. It does not read or modify any database, upload to Cloudinary, traverse symlink entries, copy private documents, overwrite destination files or delete originals.

Example commands for **later approved use**, not executed against production:

```bash
# tsx must be installed in the operator's audited checkout; no runtime app dependency is added.
node --import tsx scripts/uploads-migrate.mjs --source /ABSOLUTE/RECOVERY/public/uploads --target /home/u749284283/joro-uploads > upload-copy-dry-run.json

# Review the manifest, confirm backup and approve this specific source/target before --apply.
node --import tsx scripts/uploads-migrate.mjs --source /ABSOLUTE/RECOVERY/public/uploads --target /home/u749284283/joro-uploads --apply > upload-copy-result.json
```

The target must pass production external-root checks; run the utility from an application/recovery checkout separate from the target. Node 20+ and the repository's `tsx`/Sharp dependencies are required. On the restricted Windows runner, use the existing `--require ./scripts/test-userinfo-fallback.cjs` prefix if needed. Dry-run may exit 2 when it reports conflicts/rejected entries; do not ignore those rows. Manifest rows carry source SHA-256 and status. `--apply` verifies copied bytes. No-overwrite races fail safely. Preserve both manifests and originals. A failed result never justifies deleting a target or blindly rerunning with overwrite.

Inventory actual production references and source files separately before copying: current/previous release files, real backups, Git-tracked files and existing Cloudinary assets. The local checkout contains 104 tracked upload paths; that is not a complete production inventory. Recover only real originals, preserving the same relative paths. Unknown/missing originals remain missing until a backup or owner upload exists. Do not fabricate filenames, perform a full restore or mass-update URLs. Legacy fallback only protects files available in the running release; copying available originals into durable storage is still required to protect them through later deployments.

## Exact image-only release manifest

This includes the preceding local image work retained for compatibility; it excludes every Services and Welcome-strip change:

```text
.gitignore
next.config.mjs
app/api/admin/uploads/storage/route.ts
app/api/image/[id]/route.ts
app/api/reviews/photo/route.ts
app/api/reviews/route.ts
app/api/upload/route.ts
app/api/uploads/[...path]/route.ts
app/api/vendor/upload/route.ts
app/api/wants/[id]/route.ts
app/api/wants/route.ts
lib/cloudinary.ts
lib/cloudinary-policy.ts
lib/cloudinary-client-upload.ts
lib/public-uploads.ts
lib/review-policy.ts
lib/want-photo-file.ts
lib/want-schema.ts
scripts/uploads-migrate.mjs
scripts/test-public-uploads-http.mjs
tests/cloudinary-storage.test.ts
tests/public-uploads.test.ts
docs/CLOUDINARY_IMAGE_STORAGE.md
docs/CLOUDINARY_HISTORICAL_RECOVERY.md
docs/PUBLIC_UPLOADS_READINESS.md
```

No private configuration, package/lockfile, Services file, Prisma schema, migration SQL, migration manifest, checkout, order or payment implementation was edited for this filesystem change. Earlier uncommitted Services work, including `20261101000000_service_catalog_coverage`, remains in the working tree and must not be released with this fix.

## Controlled release and production-persistence acceptance plan

All steps that write production files, update records, configure/restart an app, commit, push or deploy need separate explicit approval. No such approval is requested or presumed by these example commands.

1. Verify the exact production commit. Local branch is `main`, HEAD `5eab8fe74f77b461561ed02d33e9715ee115bdab`; do not assume the live release matches it. Preserve this dirty worktree. Create a separate image-only checkout from the verified production base after approval:

   ```powershell
   git worktree add -b fix/persistent-public-images ../joro-image-release <VERIFIED_PRODUCTION_BASE_SHA>
   ```

2. Copy only the manifest paths into it, using literal path handling for bracketed routes. If the live base differs, adapt the image diff against that base instead of overwriting independently changed code. Review `git status --short` and `git diff --name-only`. Confirm no Services changes, no new Services migration, and a clean `git diff --exit-code -- prisma`. Install/generate/build using that checkout's production-compatible schema and unchanged lockfile. Keep `JORO_DEPLOY_MIGRATIONS=false`. Never use `build:deploy`, `migrate deploy`, `db push` or resets for this image fix. Repeat automated checks on the isolated checkout before approval to publish it.
3. Obtain Hostinger persistence confirmation for this plan/path and a backup of existing media. Run the image-only release in staging with an external persistent root. Verify the diagnostic endpoint inside its actual Node process and then authenticated uploads for each role/form. Do not test the dirty Services code against the old production schema.
4. Capture a proposed read-only inventory/dry-run of historical originals and target conflicts. Request approval for the exact file-copy batch; run the exclusive utility only after approval. Preserve originals and manifests. The new code can read legacy files while recovery is being audited; it cannot recover unavailable bytes.
5. Prepare an approval request identifying the image-only release hash, deployment target, runtime variable change if any, recovery copy batch, disposable test account/image, restart/redeployment window and rollback build. Possible impact: brief application interruption during restart/release switch; upload failures if runtime access or hard links are unavailable. No schema migration or mass URL rewrite is needed.
6. After approval, deploy only the reviewed image release. Confirm the runtime diagnostic and a disposable real upload. Verify on-disk relative path, actual file owner, URL HTTP 200, response MIME, preview, saved-page reload and downloaded/file SHA-256. Do not change existing production records for testing without approval; explicitly identify any disposable test record to create.
7. With separately approved restart, repeat HTTP 200/checksum and application-page checks. With separately approved controlled deployment, switch to a new image-only release using the same `UPLOADS_DIR`; repeat the same checks without copying the test image between releases. Verify existing category, product, store, Want, review and promotion URLs. Check private-document access controls.
8. Record actual release IDs, process UID, timestamps, test URLs and checksums. Only then mark Hostinger deployment persistence verified. Retain the disposable asset unless cleanup is explicitly approved.
9. Rollback must keep the compatible `/api/image/<id>` readers and `/uploads` filesystem route: the old application cannot interpret reference-tagged ProductImage rows or serve external files. Prepare a compatibility rollback build rather than blindly reverting to an old binary-only reader. Keep the storage directory, images, URL references and backups untouched. Do not restore the database or remove Services migration history.

No commit, push, production deployment/restart, migration, live database modification or original-image deletion occurred during this work.
