# Final preflight: manual production checks required

This operator document is **not part of the 25-file release**. It does not change the prepared candidate. Run only the read-only checks below for now. Do not copy files, change ownership/configuration, create test uploads, install dependencies, restart, deploy or run migrations until separately approved.

## Current verified facts

- Automated SSH authentication was retried and returned `Permission denied (publickey,password)`. Successful previous interactive SSH sessions do not establish current automated access.
- The isolated candidate still has exactly 25 unique manifest files and exactly those 25 changed paths. Every candidate file matches the prior SHA-256 audit. Prisma, packages, tsconfig and all historical tracked media are unchanged from its base. No Services migration or uncommitted Services implementation is included. Nothing is staged.
- The existing 219 passing tests/build/release-switch evidence remains applicable because candidate code bytes are unchanged. This preflight did not rerun unchanged application tests.
- A fresh read of `https://joro.pk/uploads/promotions/1789579915458-banner.png` returned **HTTP 500**, `text/plain`, 14 bytes, not a valid image. No image was recovered from that response. This is a pre-release observation, not an error introduced by deployment of the candidate (it has not been deployed). The cause cannot be diagnosed from the HTTP response alone.
- The local tracked banner is still an 8-byte PNG header. No production backup/release files have been inspected through SSH, so recovery from those sources is pending.
- The last successful schema audit was 2026-11-01 09:16:03 UTC / 14:16 PKT. It verified MariaDB 11.8.9 and the candidate's six pre-Services migrations. A fresh audit and the exact live application commit remain unverified.

## 1. Connect interactively

From the Windows project terminal:

```powershell
Set-Location -LiteralPath 'C:\Users\hamid\Pictures\IN-range-by-Abdullah'
ssh.exe -p 65002 -o StrictHostKeyChecking=yes -o UserKnownHostsFile=.joro-live/known_hosts u749284283@145.79.26.151
```

Complete password/key authentication in that terminal only. Use the hosting SSH credential, not an assumed database password. Do not paste passwords, private keys, complete environment files, process command lines or connection URLs into chat. Do not disable host-key checking.

## 2. Read-only release, storage and Node-process identity

In SSH, run:

```bash
id
date -u
stat -c '%U %G %a %F' /home/u749284283/joro-uploads
readlink -f /home/u749284283/joro-uploads
if command -v namei >/dev/null 2>&1; then namei -l /home/u749284283/joro-uploads; fi
if command -v getfacl >/dev/null 2>&1; then getfacl -p /home/u749284283/joro-uploads; fi
node --version
```

Then paste this Node block. It reads only selected `/proc` metadata and only the two relevant runtime settings; it does not print the whole environment or command line. The access checks run by this command are labeled as SSH-process checks, not as the application's access.

```bash
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const expected = '/home/u749284283/joro-uploads';
const domain = '/home/u749284283/domains/joro.pk';
const out = { expectedUploadsDir: expected, releases: [], nodeProcesses: [] };
for (const entry of [domain + '/hbuilds/current', domain + '/public_html', domain + '/public_html/nodejs']) {
  try { out.releases.push({ entry, resolved: fs.realpathSync(entry) }); } catch {}
}
try {
  const s = fs.statSync(expected);
  out.storage = { realPath: fs.realpathSync(expected), uid: s.uid, gid: s.gid, mode: (s.mode & 0o777).toString(8), directory: s.isDirectory() };
  try { fs.accessSync(expected, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK); out.sshNodeProcessAccess = true; }
  catch { out.sshNodeProcessAccess = false; }
} catch { out.storage = { unavailable: true }; }
for (const pid of fs.readdirSync('/proc').filter(x => /^[0-9]+$/.test(x) && Number(x) !== process.pid)) {
  try {
    const base = '/proc/' + pid;
    const comm = fs.readFileSync(base + '/comm', 'utf8').trim();
    if (!/^(node|next-server|next-start)/.test(comm)) continue;
    const cwd = fs.readlinkSync(base + '/cwd');
    if (!(cwd === domain || cwd.startsWith(domain + '/'))) continue;
    const status = fs.readFileSync(base + '/status', 'utf8');
    const values = key => (status.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'))?.[1] || '').trim().split(/\s+/).filter(Boolean).map(Number);
    const p = { pid: Number(pid), commandName: comm, cwd, uid: values('Uid'), gid: values('Gid'), groups: values('Groups') };
    try {
      const env = fs.readFileSync(base + '/environ', 'utf8').split('\0');
      const selected = key => env.find(x => x.startsWith(key + '='))?.slice(key.length + 1);
      const uploadValue = selected('UPLOADS_DIR');
      p.uploadsDirConfigured = uploadValue !== undefined;
      p.uploadsDirMatchesExpected = uploadValue === expected;
      const flag = selected('JORO_DEPLOY_MIGRATIONS');
      p.deployMigrationsFlag = flag === undefined ? 'unset' : ['false', 'true'].includes(flag) ? flag : 'other-value-redacted';
    } catch { p.selectedEnvironmentReadable = false; }
    try {
      const s = fs.statSync(base + '/root' + expected);
      p.storageVisibleInProcessRoot = true;
      p.storageUid = s.uid; p.storageGid = s.gid;
      const uid = p.uid[1], gid = p.gid[1];
      const bits = uid === s.uid ? (s.mode >> 6) & 7 : (gid === s.gid || p.groups.includes(s.gid)) ? (s.mode >> 3) & 7 : s.mode & 7;
      p.posixModeAllowsRWXEstimate = uid === 0 || bits === 7;
      p.actualApplicationWriteTestPerformed = false;
    } catch { p.storageVisibleInProcessRoot = false; }
    try { p.nextBuildId = fs.readFileSync(path.join(cwd, '.next/BUILD_ID'), 'utf8').trim(); } catch {}
    const git = cp.spawnSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (git.status === 0) p.repositoryHeadEvidenceOnly = git.stdout.trim();
    out.nodeProcesses.push(p);
  } catch {}
}
out.warning = 'UID arrays are real/effective/saved/fs IDs. POSIX mode estimates do not prove ACL, mount, hard-link or actual application access. Repository HEAD and Next BUILD_ID do not by themselves prove the deployed source commit.';
console.log(JSON.stringify(out, null, 2));
NODE
```

If no target process is visible, or `/proc` access is restricted, report that result; do not assume a PID or grant privileges. Confirm the target PID/runtime user, effective groups and exact source commit/build ID through Hostinger's deployment/runtime view or support. If `node` is unavailable in the SSH shell, report that rather than installing anything. The Node process may run in a different mount namespace/container from SSH; a mode-bit estimate is not a substitute for the later in-app diagnostic and real upload.

In Hostinger, record the exact deployed Git commit and release/build ID. Compare the source commit to candidate base `5eab8fe74f77b461561ed02d33e9715ee115bdab`. If different, stop for a base reconciliation. Confirm `UPLOADS_DIR` matches the exact path and `JORO_DEPLOY_MIGRATIONS=false` in the app's runtime settings. Do not copy other settings or secret values. Ask Hostinger to confirm this external directory is supported across release/container switches for the plan.

## 3. Read-only database inspection

Use an existing authorized database client/phpMyAdmin, or the CLI below if already installed. It prompts for the database password privately; never put the password in command arguments or send it here:

```bash
mysql --host=127.0.0.1 --port=3306 --user=u749284283_inrange --password u749284283_inrange
```

Run only these SELECTs (no migration/status tooling, session changes, DDL or writes):

```sql
SELECT VERSION() AS version, DATABASE() AS database_name,
       @@lower_case_table_names AS lower_case_table_names;

SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM `_prisma_migrations`
ORDER BY started_at, migration_name;

SELECT TABLE_NAME, ENGINE, ROW_FORMAT, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('productimage','category','product','vendorproduct','vendor',
                     'want','review','vendorpromotion','serviceoffering',
                     'servicecatalog','servicelocationrequest')
ORDER BY TABLE_NAME;

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND ((TABLE_NAME = 'productimage')
    OR (TABLE_NAME = 'serviceoffering')
    OR (TABLE_NAME = 'product' AND COLUMN_NAME = 'listingImageUrls')
    OR (TABLE_NAME = 'want' AND COLUMN_NAME IN ('photo','photos')))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

Compare active checksums against `.release-prep/image-storage/prisma/migration-manifest.json`. Expect the six active migrations listed in the release plan, plus the known archived history; investigate any unfinished/rolled-back active rows or unknown active migration. The new Services migration must not be in the candidate. If it has since been applied to production or other schema changes exist, report them rather than trying to undo them. Previously, `servicecatalog` and `servicelocationrequest` were absent and the serviceoffering coverage/catalog/priceType columns had not been added. No image migration is needed.

To inventory **public image references only**, after verifying these tables/columns exist, run:

```sql
SELECT DISTINCT image AS public_image_reference FROM category WHERE image <> '';
SELECT listingImageUrls AS public_image_references FROM product WHERE listingImageUrls IS NOT NULL;
SELECT images AS public_image_references FROM vendorproduct;
SELECT photo, photos FROM want WHERE photo IS NOT NULL OR photos IS NOT NULL;
SELECT DISTINCT imageUrl AS public_image_reference FROM review WHERE imageUrl IS NOT NULL;
SELECT shopLogo, storeBanner FROM vendor WHERE shopLogo IS NOT NULL OR storeBanner IS NOT NULL;
SELECT desktopImage, mobileImage FROM vendorpromotion
WHERE desktopImage IS NOT NULL OR mobileImage IS NOT NULL;
SELECT mimeType, COUNT(*) AS image_rows FROM productimage GROUP BY mimeType;
```

Keep the full reference inventory private. Do not export customer identities, binary blobs, vendor documents, payment proofs or private attachments. New-arrival/other legacy JSON catalog image references must also be reviewed from verified public catalog files in the actual release; database inventory alone is not exhaustive. Share only necessary public paths, aggregate results and metadata for review.

## 4. Read-only public-file inventory and banner search

The following block inventories only the six public namespaces in persistent storage and public/uploads directories discovered within JORO's current/available versioned releases. It does not follow child symlinks, read private document namespaces, create directories, copy, overwrite or delete files. It hashes originals without changing them. It does not automatically restore Hostinger backups.

```bash
node <<'NODE'
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const domain = '/home/u749284283/domains/joro.pk';
const allowed = new Set(['categories','products','promotions','vendor-products','wants','reviews']);
const roots = new Set();
const result = { roots: [], files: [], skippedSymlinks: [], errors: [], bannerCandidates: [] };
async function addRoot(p) { try { const real = await fsp.realpath(p); if ((await fsp.stat(real)).isDirectory()) roots.add(real); } catch {} }
async function discover(p, depth = 0) {
  if (depth > 4) return;
  let entries;
  try { entries = await fsp.readdir(p, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory() || e.isSymbolicLink() || e.name.startsWith('.') || ['node_modules','storage'].includes(e.name)) continue;
    const full = path.join(p, e.name);
    if (e.name === 'public') await addRoot(path.join(full, 'uploads'));
    else await discover(full, depth + 1);
  }
}
async function digest(file) {
  const h = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}
async function walk(root, directory = root, parts = []) {
  let entries;
  try { entries = await fsp.readdir(directory, { withFileTypes: true }); }
  catch { result.errors.push({ root, relative: parts.join('/'), error: 'unreadable-directory' }); return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const next = [...parts, e.name];
    if (!allowed.has(next[0])) continue;
    const full = path.join(directory, e.name), relative = next.join('/');
    if (e.isSymbolicLink()) { result.skippedSymlinks.push({ root, relative }); continue; }
    if (e.isDirectory()) { if (next.length < 3) await walk(root, full, next); continue; }
    if (!e.isFile()) continue;
    try {
      const s = await fsp.stat(full);
      const row = { root, relative, bytes: s.size, modifiedAt: s.mtime.toISOString(), sha256: await digest(full) };
      result.files.push(row);
      if (e.name === '1789579915458-banner.png') result.bannerCandidates.push({ ...row,
        headerOnly: s.size === 8, requiresImageDecodeVerification: true });
    } catch { result.errors.push({ root, relative, error: 'unreadable-file' }); }
  }
}
(async () => {
  await addRoot('/home/u749284283/joro-uploads');
  for (const entry of [domain + '/hbuilds/current', domain + '/public_html', domain + '/public_html/nodejs']) {
    try { const real = await fsp.realpath(entry); await addRoot(path.join(real, 'public/uploads')); await discover(real); } catch {}
  }
  await discover(domain + '/hbuilds/versions');
  result.roots = [...roots];
  for (const root of roots) await walk(root);
  result.totalPublicFiles = result.files.length;
  console.log(JSON.stringify(result, null, 2));
})().catch(() => { console.log(JSON.stringify({ error: 'Inventory unavailable; no files changed' })); process.exitCode = 1; });
NODE
```

Inventory may not be atomic while customers upload; record the time and later arrange an approved final upload freeze/reconciliation. Existing files with different hashes at the same relative URL are conflicts, never overwrite candidates. Names and sizes are not enough to select an original: decode/preview and compare checksums before any recovery copy. The larger banner candidates are not automatically considered valid.

If the exact deployment layout differs, supply the verified paths for review rather than expanding the scan to unrelated accounts/directories. In Hostinger's file-backup interface, inspect available backup dates and locate the same public banner path. Do not restore a whole website/database. Extracting/copying a backup to production or even creating a recovery directory on the server requires a separately approved action. A valid original may be downloaded to a separate local recovery workspace after its identity is confirmed; do not overwrite the tracked 8-byte file blindly.

If no valid release/backup/owner original exists, report `/uploads/promotions/1789579915458-banner.png` for manual owner replacement. No fabricated image or URL will be substituted. The public HTTP 500 response is not a recoverable original.

## 5. Recovery copy plan — prepared, not authorized to run

Use the already-tested non-overwriting utility described in `docs/IMAGE_STORAGE_RELEASE_PLAN.md`. Its default is dry-run; **do not add --apply now**. It requires the audited candidate checkout and existing tsx/Sharp dependencies, which may not yet exist on the old live release. Do not upload/install the candidate on production merely to run this check without approval. Inventory blocks above need only the existing Node binary.

For a later approved operator environment, substitute the actual verified source path and first run:

```bash
node --import tsx scripts/uploads-migrate.mjs \
  --source /ABSOLUTE/VERIFIED_SOURCE/public/uploads \
  --target /home/u749284283/joro-uploads
```

This prints the dry-run manifest without writing files. Exit 2 means rejected/conflicting sources need review. Share/retain the manifest securely. After source/target inventory, backup confirmation and explicit batch approval, `--apply` copies only valid public originals, exclusively, verifies SHA-256, leaves conflicts untouched and never deletes originals. No database URL rewrites or schema migrations are involved. The earlier local dry-run found 103 valid copy candidates, one rejected header-only PNG and zero target writes; this is not the live inventory.

## 6. Commit/push/deploy and post-deployment checks

The exact isolated branch/stage/commit/push commands and Hostinger deployment order are already in `docs/IMAGE_STORAGE_RELEASE_PLAN.md` in both checkouts. They have not run. Use the candidate's 25-file manifest with literal path handling. Confirm the live base before creating a release commit, verify staged paths/protected Prisma/media paths, and ensure auto-deploy cannot run before production approval.

After the live preflight results are reviewed and the operations are separately approved:

1. Preserve/backup historical media and complete the approved non-overwriting recovery batch with final upload reconciliation. Retain originals and resolve/review the banner exception.
2. Publish/deploy only the approved image-only commit. Keep `JORO_DEPLOY_MIGRATIONS=false`, `UPLOADS_DIR=/home/u749284283/joro-uploads`, normal `npm run build` and the existing start configuration. Do not merge any uncommitted Services source or run database migrations.
3. Authorized admin GET `/api/admin/uploads/storage` must show 200 with configured, accessibleToNodeProcess and externalToRelease true. The endpoint exposes flags/UID, not directory values or credentials. Check anonymous access is 401. The diagnostic alone does not prove an actual write.
4. Approve one disposable public image through an authenticated existing uploader without modifying a real category/product record. Confirm immediate HTTP 200, valid preview, actual file owner/location, reload and source/stored/download SHA-256. Explicitly approve any test record if a form save is needed.
5. A production restart is a separate explicit approval. After it, verify the same image URL/checksum and representative old image URLs.
6. A subsequent redeploy is another explicit approval: deploy the same approved image-only commit with unchanged storage setting, record a new release/build ID, do not recopy the test image, then repeat HTTP 200/MIME/checksum/diagnostic checks. Only then claim live deployment persistence.
7. Preserve all data, assets and the disposable image unless cleanup is separately approved. Retain a rollback build with the new image-reference readers and external serving route. No database restore is needed for this image release.

## Send back only safe results

Provide: Hostinger source commit/build ID; directory/process metadata and the two selected-variable match results; SELECT-only version/history/schema metadata; public-file counts/conflicts and relevant banner candidate paths/checksums. Never send a password, API key, full environment, raw process command line, private attachment or database connection URL.

Until those results are reviewed, production version/schema, exact runtime permissions, historical recovery sources and live persistence remain unverified blockers. No production release action is approved by this document.
