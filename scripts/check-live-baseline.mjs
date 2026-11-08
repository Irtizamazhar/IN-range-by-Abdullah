// SELECT-only production audit using a separate unchanged committed migration baseline.
// The original working tree/profile are never rewritten; deployment has no entry point here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { repositoryState, readLiveUrl, inspectDatabase, LiveSafetyError, ensure, safeDatabaseFailure } from './lib/live-db-safety.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = path.join(root, '.release-prep/live-readonly-1358fde');
const pinned = '1358fde96e77e39c2ef05cff6026edae6381b2e7';
let stage = 'committed baseline verification';
let db;
let profileHash;
const hashProfile = () => createHash('sha256').update(fs.readFileSync(path.join(root, '.env.live.local'))).digest('hex');
const git = args => spawnSync('git', ['-C', baseline, ...args], { encoding: 'utf8', windowsHide: true });
async function main() {
  ensure(process.argv.slice(2).every(arg => arg === '--offline'), 'Only --offline is supported. This tool cannot migrate, backfill or deploy.');
  const top = git(['rev-parse', '--show-toplevel']);
  ensure(top.status === 0 && path.resolve(top.stdout.trim()) === baseline, 'The separate baseline worktree is missing or invalid.');
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  ensure(common.status === 0 && path.resolve(common.stdout.trim()) === path.join(root, '.git'), 'Audit worktree must belong to the original repository.');
  const clean = git(['status', '--porcelain']);
  ensure(clean.status === 0 && clean.stdout.trim() === '', 'Audit worktree must remain completely clean.');
  const repo = repositoryState(baseline, true); // Same committed-payload/checksum guard; no bypass.
  ensure(repo.commit === pinned, 'Audit baseline revision changed.');
  console.log(JSON.stringify({ baselineVerified: true, revision: repo.commit, committedMigrationCount: repo.migrations.length, readOnly: true }));
  if (process.argv.includes('--offline')) return;

  stage = 'original protected profile validation';
  profileHash = hashProfile();
  const url = readLiveUrl(root); // Fixed-target validation, no .env copying or fallback to joro_local.
  stage = 'authorized managed tunnel verification';
  const verified = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/verify-live-audit-tunnel.ps1')], { encoding: 'utf8', windowsHide: true });
  ensure(verified.status === 0 && JSON.parse(verified.stdout).verified === true, 'The original managed SSH process/listener is not verified. Start the authorized tunnel from the original workspace; no unverified listener will be reused.');

  stage = 'production identity and committed migration history (SELECT only)';
  const { PrismaClient } = await import('@prisma/client');
  db = new PrismaClient({ datasourceUrl: url });
  const info = await inspectDatabase(db, repo.migrations, repo.legacyMigrations, value => { stage = value; });
  stage = 'production version and aggregate counts (SELECT only)';
  const [version] = await db.$queryRawUnsafe('SELECT VERSION() AS version, @@version_comment AS provider_comment');
  const [products] = await db.$queryRawUnsafe('SELECT COUNT(*) AS total_products, COALESCE(SUM(isActive = 1), 0) AS active_products FROM product');
  const [publicProducts] = await db.$queryRawUnsafe("SELECT COUNT(*) AS public_products FROM product p WHERE p.isActive=1 AND (NOT EXISTS (SELECT 1 FROM vendorproduct vp WHERE vp.publishedProductId=p.id) OR EXISTS (SELECT 1 FROM vendorproduct vp JOIN vendor v ON v.id=vp.vendorId WHERE vp.publishedProductId=p.id AND vp.status='active' AND v.status='approved'))");
  const [categories] = await db.$queryRawUnsafe('SELECT COUNT(*) AS total_categories, COALESCE(SUM(isActive = 1), 0) AS active_categories FROM category');
  const slugColumn = await db.$queryRawUnsafe("SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'");
  const slugIndexes = await db.$queryRawUnsafe("SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'");
  const report = {
    verifiedAt: new Date().toISOString(), readOnly: true, baselineRevision: repo.commit,
    databaseIdentityVerified: true, database: info.database, version, products, publicProducts, categories,
    appliedMigrations: info.applied, pendingAgainstCommittedBaseline: info.pending,
    baselineMigrationCount: repo.migrations.length,
    note: 'The uncommitted slug migration is not part of this nine-migration baseline. No production mutation is available in this tool.',
    slugColumn, slugIndexes,
  };
  const output = JSON.stringify(report, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2);
  fs.writeFileSync(path.join(root, '.release-prep/live-readonly-production-report.json'), output + '\n');
  console.log(output);
}
try { await main(); }
catch (error) {
  console.error('Read-only audit stopped at ' + stage + '. ' + (error instanceof LiveSafetyError ? error.message : safeDatabaseFailure(error)));
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
  if (profileHash) {
    try { ensure(hashProfile() === profileHash, 'Private profile contents changed during audit.'); console.log('Private profile unchanged.'); }
    catch { console.error('Private profile preservation could not be verified.'); process.exitCode = 1; }
  }
}
