# Image-only release preparation

Prepared on 1 November 2026. **Image-only candidate validated locally; publication and production operations await approval.** No commit, staging, push, migration, production deployment/restart, live record update or production file copy has been performed.

## Prepared checkout and exact scope

```text
Original checkout: C:\Users\hamid\Pictures\IN-range-by-Abdullah
Isolated checkout: C:\Users\hamid\Pictures\IN-range-by-Abdullah\.release-prep\image-storage
Original branch: main (unchanged)
Candidate base: 5eab8fe74f77b461561ed02d33e9715ee115bdab
Isolated HEAD: detached at that base; 25 allowlisted files are uncommitted
Authoritative file list: docs/IMAGE_STORAGE_RELEASE_MANIFEST.json
```

The exact 25-file manifest includes public upload handlers/helpers, serving/diagnostic routes, image-reference compatibility, tests and current release documentation. It excludes the obsolete Cloudinary proposal documents, all Services changes, Welcome-strip changes, private environment files and the unrelated uncommitted database-safety test changes. `.gitignore` also excludes the local `.release-prep` worktree so it cannot enter a blanket add from the original checkout.

The complete original diff was classified as image changes, Services implementation/schema changes, Welcome-strip changes and unrelated deployment-test changes. Only image paths were copied. Excluded original files are fingerprinted for preservation checking. No source was reset, stashed, discarded or replaced with the older release version.

The isolated checkout has its own lockfile-installed dependencies and generated Prisma Client. It does not share the original checkout's generated client. No `.env`, `.env.local`, `.env.live.local` or live credentials were copied. No dependency/lockfile change is part of the release.

The first worktree location under `node_modules/.cache` was unsuitable because Next.js and tsx exclude application source under `node_modules`. It was moved, without discarding files, to the path above; the successful checks below ran from the corrected location. An npm sandbox/network failure was retried with approval. Prisma's download host later failed DNS; already-installed Windows engines were copied into the isolated dependencies only after checking matching `@prisma/engines` and `@prisma/engines-version` package versions. Those binaries are ignored dependencies, not release source. Hostinger still installs/generates its own Linux runtime artifacts.

## Production-schema compatibility

The candidate's entire `prisma` tree is unchanged from its base. It has only these six active migrations:

```text
0_baseline
20261018000000_add_want_report
20261022000000_pickup_management
20261024000000_customer_reset_otp
20261025000000_standalone_quote_service_booking
20261025010000_want_photos
```

`20261101000000_service_catalog_coverage` is **absent**. The candidate does not contain the uncommitted ServiceCatalog/coverage/priceType implementation. Its existing Services functionality remains the pre-change base version.

The schema fingerprint is `c89fe5a1513151134348805743ffa2a28ae9989af0e3684a8f77b1e4ce371e9b`. Prisma Client 6.19.2 generated from this older schema, and the entire candidate built and typechecked against that client. Public images use existing URL fields; new admin ProductImage records use the already-existing data/mimeType fields as tagged URL references. There are no new columns, tables, constraints, migrations or data conversions.

This matches the pre-Services schema checked in the earlier production audit at **2026-11-01 09:16:03 UTC / 14:16 PKT**, which verified MariaDB **11.8.9**, the six active migration checksums and no missing/changed pre-existing columns. That audit also recorded unrelated index/foreign-key drift; this release does not attempt to repair it.

**Limit:** there is no reachable database tunnel for a fresh read-only inspection, and the exact live application commit has not been independently confirmed. Compatibility is verified against the last audited production schema, not a newly queried live database. Before publication, confirm the Hostinger deployment's exact source commit and that no intervening schema change occurred. If the live base differs, reconcile against that base and repeat the image-only checks; do not replace newer unrelated code with this candidate blindly.

Keep `JORO_DEPLOY_MIGRATIONS=false`. Neither publication nor normal build requires any Prisma migration command.

## Candidate validation results

| Check run in isolated checkout | Result |
| --- | --- |
| Existing `npm test` suite | 206/206 passed, including original committed-schema safety tests |
| Filesystem/Cloudinary compatibility tests | 13/13 passed |
| Production-schema Prisma Client generation | Passed, 6.19.2, isolated dependency tree |
| TypeScript | Passed |
| Lint | Passed; existing unrelated img warnings |
| Optimized production build | Passed; existing Browserslist/Edge jose/deprecation warnings |
| Real local production HTTP / two release directories | Passed |
| Runtime-created image without restart | HTTP 200 |
| Available legacy URL | HTTP 200 |
| Private file under static public/uploads | HTTP 404, rewrite prevents bypass |
| Anonymous, forged-admin-cookie, signed customer-role diagnostic requests | HTTP 401 each; no storage details |
| Image checksums across local process/release switch | Identical |
| Historical tracked image bytes | All 104 retained byte-for-byte |
| Historical recovery dry-run | 103 would copy; 1 rejected; zero target entries |
| Changed candidate files outside manifest / Prisma diff | None |

The local HTTP fixture checksum was `6af86114db4f7b492aa67dd78f2a0afbe1b7a30a19dda3b349f3e978fb037813`. Production-build output is under the candidate's `node_modules/.cache/joro-persistent-build`. The temporary Next.js tsconfig include was restored afterward. Build DATABASE_URL pointed to unused localhost port 9; automatic migrations were explicitly disabled. Automated fixtures mock database operations and do not target production.

These are local Windows checks. They do not establish Hostinger/Linux storage access, hard-link capability, browser save/reload against the live database or provider persistence through an actual redeployment.

## Diagnostic security

`GET /api/admin/uploads/storage` awaits `requireAdminPermission("catalog.manage")` **before** storage inspection. Existing RBAC checks the server session's admin role, active admin identity and effective permissions. The existing environment-admin compatibility behavior is unchanged. No client-supplied role or storage path is accepted.

Successful responses are `Cache-Control: no-store`, contain only configuration/accessibility flags and the Node process UID, and never return UPLOADS_DIR's value, credentials, environment contents, error stacks or filesystem paths. Storage failures return a generic 503. The diagnostic performs no file writes, uploads, migration or database update. A successful flag is an access-permission check, not proof that hard-link publication or redeployment persistence works. `persistenceVerified` intentionally remains false.

Local production-server HTTP tests confirmed 401 for anonymous, forged-cookie and valid customer-role sessions, without configuration/path details. The existing RBAC code was reviewed for the permission gate; a real authorized admin 200 response and a live insufficient-permission admin test remain staging/live acceptance tasks.

## Historical images: current findings and exact safe procedure

All 104 Git-tracked image files are identical in both checkouts. No historical file is included as a deletion or modification. New application writes use persistent storage; physical cleanup/deletion is disabled. Existing binary database images and Cloudinary URLs remain readable. Legacy disk fallback can read only originals actually available in a release; it cannot protect missing release files or reconstruct a missing image.

One tracked original is incomplete:

```text
/uploads/promotions/1789579915458-banner.png
Source: public/uploads/promotions/1789579915458-banner.png
Size: 8 bytes; PNG header only; no decodable image
Action: retained, rejected by migration; obtain actual original from backup or owner
```

Do not fabricate its replacement or claim it recovered. Its current production/database use is unknown without an inventory. This is a recovery limitation, not evidence of a new deletion by this release.

A real dry-run against the candidate's tracked `public/uploads` reported 103 `would-copy` and one `rejected-or-copy-failed-original-retained`; exit 2 is intentional for that rejected source. The local target stayed empty. The report is retained at `.release-prep/image-storage/node_modules/.cache/historical-image-dry-run.json`.

Production procedure, requiring approval before copies or any write freeze:

1. Confirm the exact active release/source paths through authenticated hosting access. Inventory all public database references separately with read-only SELECTs, and inventory real source files in current/previous releases and backups. Do not assume the 104 tracked files cover runtime uploads. Do not include private identity/support/payment documents in public recovery.
2. Obtain and verify a media backup outside versioned releases. Retain the active release/originals. Arrange an approved brief upload freeze or maintenance window so old application uploads cannot arrive between the final inventory/copy and release switch. Final reconciliation must include any files written during transition. Do not alter maintenance configuration without approval.
3. Run a dry-run from the verified operator/application checkout. Replace the source placeholder with a verified absolute path; do not guess the active hbuild directory. `tsx` and Sharp must be installed from the unchanged lockfile. Capture the manifest in a private audit directory and check its exit status:

   ```bash
   node --import tsx scripts/uploads-migrate.mjs \
     --source /ABSOLUTE/VERIFIED_SOURCE/public/uploads \
     --target /home/u749284283/joro-uploads > /PRIVATE/AUDIT/upload-dry-run.json
   result=$?
   printf 'Dry-run exit: %s\n' "$result"
   ```

4. Review every conflict, rejected source and would-copy row. Exit 2 is not blanket approval to proceed. Locate real originals for recoverable failures. Existing conflicting target files must remain untouched. Obtain approval for the exact reviewed source/target batch and unresolved exceptions.
5. Only after that approval, run the non-overwriting copy:

   ```bash
   node --import tsx scripts/uploads-migrate.mjs \
     --source /ABSOLUTE/VERIFIED_SOURCE/public/uploads \
     --target /home/u749284283/joro-uploads --apply > /PRIVATE/AUDIT/upload-copy-result.json
   result=$?
   printf 'Copy exit: %s\n' "$result"
   ```

6. Keep both reports. The utility decodes allowed public images, records source SHA-256, copies through exclusive publication and verifies target bytes. Identical targets are skipped; different targets are retained as conflicts. Sources are never deleted. Repeat dry-run to confirm no unexplained `would-copy` rows remain for the approved inventory. No `--overwrite`, database URL rewrite, full restore or destructive cleanup is required or permitted.
7. Verify the original URLs after the approved release; record unresolved missing/corrupt source paths. The utility changes no database records. Preserve original files and recovery backups after success.

## Exact Git commands

The detached worktree is already prepared. Do not rerun creation over it. For reproducibility, the creation command used was equivalent to:

```powershell
Set-Location -LiteralPath 'C:\Users\hamid\Pictures\IN-range-by-Abdullah'
git worktree add --detach .release-prep/image-storage 5eab8fe74f77b461561ed02d33e9715ee115bdab
```

Read-only review now:

```powershell
$projectRoot = 'C:\Users\hamid\Pictures\IN-range-by-Abdullah'
$releaseRoot = Join-Path $projectRoot '.release-prep/image-storage'
git -C $releaseRoot status --short
git -C $releaseRoot diff --stat
git -C $releaseRoot diff --check
git -C $releaseRoot diff --exit-code -- prisma package.json package-lock.json tsconfig.json
git -C $releaseRoot diff --name-status --diff-filter=D
Test-Path -LiteralPath (Join-Path $releaseRoot 'prisma/migrations/20261101000000_service_catalog_coverage')
```

Expected: no deletion output, no schema/package/tsconfig diff, pending Services migration False. The authoritative changed-path allowlist is the manifest, including new untracked files.

The exact copy operation used only manifest paths. If rebuilding a **new empty candidate checkout** later, use literal file copying so bracketed route names are not wildcard-expanded:

```powershell
$manifestPath = Join-Path $projectRoot 'docs/IMAGE_STORAGE_RELEASE_MANIFEST.json'
$releaseFiles = (Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json).files
foreach ($relativeFile in $releaseFiles) {
  $sourceFile = Join-Path $projectRoot $relativeFile
  $targetFile = Join-Path $releaseRoot $relativeFile
  New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force | Out-Null
  Copy-Item -LiteralPath $sourceFile -Destination $targetFile
}
```

**The following branch/stage/commit/push commands have NOT run. They are for after explicit plan approval, live-base confirmation, and approval of publication/auto-deploy behavior.** Never run them from the original dirty main checkout. First ensure a push cannot trigger an unapproved Hostinger deployment.

```powershell
$releaseRoot = 'C:\Users\hamid\Pictures\IN-range-by-Abdullah\.release-prep\image-storage'
$releaseFiles = (Get-Content -Raw -LiteralPath (Join-Path $releaseRoot 'docs/IMAGE_STORAGE_RELEASE_MANIFEST.json') | ConvertFrom-Json).files
git -C $releaseRoot switch -c fix/persistent-public-images
git --literal-pathspecs -C $releaseRoot add -- $releaseFiles
if ($LASTEXITCODE -ne 0) { throw 'Image-only staging failed' }
$stagedFiles = @(git -C $releaseRoot diff --cached --name-only)
foreach ($stagedFile in $stagedFiles) {
  if ($releaseFiles -notcontains $stagedFile) { throw "Unexpected staged file: $stagedFile" }
}
git -C $releaseRoot diff --cached --exit-code -- prisma public/uploads package.json package-lock.json
if ($LASTEXITCODE -ne 0) { throw 'Protected production schema, assets or dependencies changed' }
git -C $releaseRoot diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Staged diff check failed' }
git -C $releaseRoot diff --cached --stat
# Stop and review the staged candidate before the approved commit.
git -C $releaseRoot commit -m 'Fix persistent public image storage on Hostinger'
git -C $releaseRoot rev-parse HEAD
# Record the returned image-only commit hash. Push only after publication approval.
git -C $releaseRoot push -u origin fix/persistent-public-images
```

Open/review an image-only PR against the configured production branch. Do not merge or change Hostinger's deployment branch until production deployment is approved. If main auto-deploys, merging the PR is a production deployment action and requires that approval. Do not stage/commit local Services changes or use an all-files push from the dirty main worktree. No force-push, reset, pull, migration or schema synchronization is needed.

## Hostinger deployment order — after approval

1. Resolve the blocking preflight items below. Record the reviewed image-only commit hash, current live commit, production branch and a compatible rollback artifact. Confirm the PR contains no Services/schema changes. Preserve media backups and the historical copy manifests.
2. Confirm these **runtime** settings in the existing Node.js app, preserving all other credentials:

   ```text
   UPLOADS_DIR=/home/u749284283/joro-uploads
   JORO_DEPLOY_MIGRATIONS=false
   Build: npm run build
   Start: npm start (or retain the existing Hostinger start configuration)
   ```

   Retain the current supported Node runtime; do not combine this release with a runtime upgrade. Do not use `npm run build:deploy`, `prisma migrate deploy`, `db push`, reset, seed or restore commands. Normal build only generates Prisma Client and compiles Next.js. Hostinger installs the unchanged lockfile's Linux dependencies.
3. Finish the approved historical backup/copy and final upload-freeze reconciliation before allowing old releases to be pruned. Sources must not be deleted. A directory setting and a future rewrite do not recover files erased before this release.
4. Deploy the **approved image-only commit** through the existing Hostinger Git integration. If the production branch is main, merge only the reviewed image PR when the production deployment action is approved. Confirm Hostinger's source commit matches the reviewed hash; do not upload the original dirty project directory or its generated Windows build files.
5. Check build logs show migrations disabled, successful Prisma generation and a successful Next.js build. Stop on any migration command or unexpected Services source/schema. Record the resulting release/build ID. A deployment may briefly interrupt the app; use the approved window and verified rollback.
6. While signed in as an authorized catalog admin, request the diagnostic in the browser:

   ```javascript
   fetch('/api/admin/uploads/storage', { credentials: 'same-origin', cache: 'no-store' })
     .then(async response => ({ status: response.status, body: await response.json() }))
     .then(console.log);
   ```

   Expect 200 with `configured:true`, `accessibleToNodeProcess:true`, `externalToRelease:true`. This runs in the deployed Node process. A 503, missing variable or failed permission check blocks acceptance; do not use chmod 777 or switch writes back to public/uploads. Verify public/anonymous requests are 401 and no paths/credentials appear. Record UID and match it to approved ownership/permissions through hosting access.
7. Run the approved single-image persistence test below, verify representative existing images/pages, then restore normal uploads/maintenance state through the approved configuration procedure.

## One-image production redeployment test

This test must be explicitly approved as part of production deployment acceptance. It creates a disposable public file through an authenticated endpoint but can avoid changing a category/product record. If a saved form/record is to be tested, get approval for that exact disposable record too.

1. Use an authorized catalog-admin session and a small valid PNG through the category uploader (`POST /api/upload`, multipart `file` and `folder=categories-local`). Do not save changes to an existing category. Record the returned `/uploads/categories/<generated>.png` URL. No private credentials or browser cookies should be copied into shell logs.
2. Immediately GET the URL: HTTP 200, image/png, expected preview. Reload it in a new tab/session. With authorized hosting access, confirm its actual file under `/home/u749284283/joro-uploads/categories/` and record the owner. This proves actual runtime write/publication (including hard-link support), beyond the read-only diagnostic.
3. Download the returned URL to a local audit directory twice and compare SHA-256 with the source file. Example after replacing the exact returned path:

   ```powershell
   $imageUrl = 'https://joro.pk/uploads/categories/ACTUAL_RETURNED_FILENAME.png'
   Invoke-WebRequest -Uri $imageUrl -OutFile './image-before-redeploy.png'
   Get-FileHash -Algorithm SHA256 -LiteralPath './image-before-redeploy.png'
   ```

   From an authenticated hosting shell, `sha256sum /home/u749284283/joro-uploads/categories/ACTUAL_RETURNED_FILENAME.png` is read-only. Compare source, HTTP download and stored file hashes; do not assume a 200 HTML/error page is an image.
4. Request/confirm approval for one controlled Hostinger redeploy of the **same approved image-only commit**, with `UPLOADS_DIR` unchanged and migrations false. No service migration, test image recopy or database restore may be involved. Record the new Hostinger build/release ID.
5. Request the same original URL again. Expect HTTP 200, the same image MIME and SHA-256, plus the same on-disk file hash/owner. Repeat the diagnostic. Check representative existing category/product/store/Want/review/promotion pages and private document access. An optional production restart is a separate approved action, never performed implicitly during preparation.
6. Mark Hostinger deployment persistence verified only after this succeeds. Preserve the disposable asset unless deletion is separately approved. Keep test URLs, timestamps, checksums and release IDs in the release audit.

## Remaining blockers / approval boundaries

1. **Live base/current schema confirmation:** candidate base is known; live application commit and absence of subsequent schema changes need confirmation. No database tunnel is currently reachable. This is not permission to run a migration.
2. **Hostinger storage support and Node access:** directory existence and SSH-user write permission are user-reported. Running-app access, exclusive hard links and actual deployment persistence have not been verified. Confirm the plan supports this external path and complete the staged/approved runtime acceptance checks.
3. **Historical production inventory/backup:** runtime uploads and backups have not been inventoried over SSH. Preserve them before deployment/pruning. The incomplete banner needs a real source or an explicitly accepted recovery exception; no replacement is invented.
4. **Controlled production operations:** publication, any maintenance/upload freeze, file-copy batch, deployment and disposable upload/redeploy test require explicit approval. No production operation is authorized merely by this report.

Rollback must retain the reference-aware `/api/image` reader and `/uploads` serving compatibility once new reference rows/files exist. Blindly reverting to a binary-only reader can break newly uploaded admin product images; restoring an old release without the external serving route can hide persistent images. Prepare a compatible rollback/forward-fix build and preserve the storage root, original files and database records. Do not restore the database or touch Services migrations for an image rollback.
