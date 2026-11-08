// Read-only pre-migration inspection. No migration, backfill, reset or deployment action exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readLiveUrl, repositoryState, inspectDatabase, ensure, LiveSafetyError, safeDatabaseFailure } from './lib/live-db-safety.mjs';
import { prismaCliEnvironment } from './lib/migration-tools.mjs';
import { classifyCatalogDrift } from './lib/classify-catalog-drift.mjs';
const { planProductSlugs, catalogFingerprint } = createRequire(import.meta.url)('../lib/product-slug-plan.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = path.join(root, '.release-prep/live-readonly-1358fde');
const artifact = path.join(root, '.release-prep/pre-migration-safety', String(Date.now()));
let stage = 'baseline and local proposal validation', db, profileHash;
const report = { checkedAt: new Date().toISOString(), readOnly: true, backupRestorationVerified: false, productionWrites: 0 };
const profileDigest = () => createHash('sha256').update(fs.readFileSync(path.join(root, '.env.live.local'))).digest('hex');
async function select(sql) {
  ensure(/^SELECT\s/i.test(sql) && !/\b(?:INTO\s+(?:OUTFILE|DUMPFILE)|FOR\s+UPDATE)\b/i.test(sql), 'Only read-only SELECT is permitted.');
  return db.$queryRawUnsafe(sql);
}
function redact(text, url) {
  let out = String(text || '');
  const parsed = new URL(url);
  for (const secret of [url, parsed.password, decodeURIComponent(parsed.password)]) if (secret) out = out.split(secret).join('[REDACTED]');
  return out.replace(/mysql:\/\/[^\s"']+/g, '[REDACTED URL]');
}
try {
  ensure(process.argv.length === 2, 'No execution flags are supported by this read-only inspection.');
  const clean = spawnSync('git', ['-C', baseline, 'status', '--porcelain'], { encoding: 'utf8', windowsHide: true });
  ensure(clean.status === 0 && clean.stdout.trim() === '', 'Committed baseline worktree must remain clean.');
  const repo = repositoryState(baseline, true);
  ensure(repo.commit === '1358fde96e77e39c2ef05cff6026edae6381b2e7', 'Unexpected baseline revision.');
  const proposal = repositoryState(root, false); // Validate, but never deploy, the local uncommitted proposal.
  const migrationName = '20261108000000_product_readable_slug';
  const migration = proposal.migrations.find(row => row.name === migrationName);
  const normalized = migration?.sql.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  ensure(normalized === 'alter table product add column slug varchar(191) null; create unique index product_slug_key on product(slug);', 'Slug SQL differs from the reviewed two additive statements.');
  report.migration = { name: migrationName, sha256: createHash('sha256').update(migration.sql).digest('hex'), onlyChanges: ['product.slug nullable VARCHAR(191)', 'product_slug_key unique index'] };
  stage = 'protected profile and managed SSH verification';
  profileHash = profileDigest();
  const url = readLiveUrl(root);
  const tunnel = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/verify-live-audit-tunnel.ps1')], { encoding: 'utf8', windowsHide: true });
  ensure(tunnel.status === 0 && JSON.parse(tunnel.stdout).verified === true, 'Authorized managed tunnel is not verified.');
  const { PrismaClient } = await import('@prisma/client');
  db = new PrismaClient({ datasourceUrl: url });
  const history = await inspectDatabase(db, repo.migrations, repo.legacyMigrations, value => { stage = value; });
  report.baselinePending = history.pending;
  ensure(history.pending.length === 0, 'Other committed migrations are pending; stop before considering slug DDL.');
  report.pendingLocalProposal = proposal.migrations.filter(row => !history.applied.includes(row.name)).map(row => row.name);
  ensure(report.pendingLocalProposal.length === 1 && report.pendingLocalProposal[0] === migrationName, 'Unrelated local proposal migrations require separate review.');
  stage = 'production product metadata and read-only slug preview';
  report.version = (await select('SELECT VERSION() AS version, @@version_comment AS provider_comment'))[0];
  report.productTable = (await select("SELECT ENGINE, ROW_FORMAT, TABLE_COLLATION, DATA_LENGTH, INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product'"))[0];
  report.slugColumn = await select("SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'");
  report.slugIndex = await select("SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'");
  ensure(report.slugColumn.length === 0 && report.slugIndex.length === 0, 'Slug schema already exists; do not plan duplicate DDL.');
  const rows = await select('SELECT id, name, updatedAt FROM product ORDER BY createdAt, id');
  const inputs = rows.map(row => ({ ...row, slug: null }));
  const before = catalogFingerprint(inputs);
  const plan = planProductSlugs(inputs);
  ensure(catalogFingerprint(inputs) === before, 'Planner changed its input.');
  ensure(plan.length === rows.length && new Set(plan.map(row => row.slug)).size === rows.length, 'Planner does not cover every product uniquely.');
  report.preview = { totalProducts: rows.length, assignments: plan.length, uniqueSlugs: new Set(plan.map(row => row.slug)).size, allUrlSafe: plan.every(row => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) && row.slug.length <= 191), inputFingerprint: before, mappingSha256: createHash('sha256').update(JSON.stringify(plan)).digest('hex'), writes: 0, note: 'In-memory pre-column preview only. Generate the actual saved apply plan after approved schema expansion. IDs, names and proposed URLs are not logged.' };
  report.productForeignKeys = await select("SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL AND (TABLE_NAME='product' OR REFERENCED_TABLE_NAME='product') ORDER BY TABLE_NAME, COLUMN_NAME");
  const allForeignKeys = await select("SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.ORDINAL_POSITION, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.UPDATE_RULE, r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA=r.CONSTRAINT_SCHEMA AND k.TABLE_NAME=r.TABLE_NAME AND k.CONSTRAINT_NAME=r.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION");
  const allIndexes = await select("SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE, SUB_PART, COLLATION FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX");
  try { report.pendingProductMetadataLocks = await select("SELECT LOCK_TYPE, COUNT(*) AS count FROM performance_schema.metadata_locks WHERE OBJECT_SCHEMA=DATABASE() AND OBJECT_NAME='product' AND LOCK_STATUS='PENDING' GROUP BY LOCK_TYPE"); }
  catch { report.pendingProductMetadataLocks = 'Unavailable to audit user; no locks acquired or changed.'; }

  stage = 'read-only modeled-schema drift comparison';
  fs.mkdirSync(artifact, { recursive: true });
  const datasource = path.join(artifact, 'read-only-datasource.prisma');
  fs.writeFileSync(datasource, 'datasource db {\n  provider = "mysql"\n  url = env("DATABASE_URL")\n}\n');
  // migrate diff introspects source and compares a datamodel; it applies no SQL and needs no shadow DB.
  const diff = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-schema-datasource', datasource, '--to-schema-datamodel', path.join(baseline, 'prisma/schema.prisma'), '--exit-code', '--script'], { cwd: root, env: prismaCliEnvironment({ ...process.env, DATABASE_URL: url, JORO_DEPLOY_MIGRATIONS: 'false', DEBUG: '' }), encoding: 'utf8', windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync(path.join(artifact, 'READ_ONLY_DIFFERENCES_DO_NOT_APPLY.sql'), redact(diff.stdout, url));
  fs.writeFileSync(path.join(artifact, 'drift-diagnostics.log'), redact(diff.stderr, url));
  report.drift = { exitCode: diff.status, status: diff.status === 0 ? 'no modeled drift' : diff.status === 2 ? 'modeled drift detected; generated SQL must not be applied' : 'comparison failed; drift unverified', scope: 'Prisma-modeled tables, columns, indexes and relationships; not a full routine/trigger/view audit' };
  if (diff.status === 2) report.drift.classification = classifyCatalogDrift(diff.stdout, allForeignKeys, allIndexes);
  report.localBackupCandidates = ['.joro-live/backups', 'backups', 'backup'].flatMap(directory => {
    const location = path.join(root, directory);
    if (!fs.existsSync(location) || fs.lstatSync(location).isSymbolicLink()) return [];
    return fs.readdirSync(location, { withFileTypes: true }).filter(entry => entry.isFile() && /\.(sql|sql\.gz|dump|bak|zip)$/i.test(entry.name)).map(entry => { const stat = fs.statSync(path.join(location, entry.name)); return { directory, bytes: stat.size, modifiedAt: stat.mtime.toISOString(), productionOriginAndRestoreVerified: false }; });
  });
  report.verdict = 'NO-GO until a recent production backup/restore, drift review and release/rollback gates are verified.';
} catch (error) {
  report.stoppedAt = stage;
  report.error = error instanceof LiveSafetyError ? error.message : safeDatabaseFailure(error);
  report.verdict = 'NO-GO';
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
  if (profileHash) { try { report.privateProfileUnchanged = profileDigest() === profileHash; } catch { report.privateProfileUnchanged = false; } }
  fs.mkdirSync(artifact, { recursive: true });
  const output = JSON.stringify(report, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2);
  fs.writeFileSync(path.join(artifact, 'report.json'), output + '\n');
  console.log(output);
  console.log('Local audit artifacts: ' + path.relative(root, artifact));
}
