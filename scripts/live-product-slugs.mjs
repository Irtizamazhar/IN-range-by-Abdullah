// Explicit live-profile binding. Never imports dotenv or accepts a connection URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { TARGET, ensure, LiveSafetyError, readLiveUrl, repositoryState, inspectDatabase, verifiedBackup, safeDatabaseFailure } from './lib/live-db-safety.mjs';
import { createLiveSlugPlan, applyLiveSlugPlan, verifyLiveSlugRows, validateLivePlanContext, liveProductOrder } from './lib/live-product-slug-plan.mjs';
import { securePrivateFile } from './lib/live-private-file.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), action = args.shift();
let db, stage = 'argument and committed release verification';
const git = params => spawnSync('git', params, { cwd: root, encoding: 'utf8', windowsHide: true });
const executionFiles = ['scripts/live-product-slugs.mjs', 'scripts/lib/live-product-slug-plan.mjs', 'scripts/lib/live-private-file.mjs', 'scripts/lib/live-db-safety.mjs', 'scripts/lib/migration-tools.mjs', 'scripts/verify-live-audit-tunnel.ps1', 'lib/product-slug-plan.ts', 'lib/catalog-urls.ts'];
function immutableRelease() {
  const repo = repositoryState(root, true);
  ensure(git(['diff', '--quiet', 'HEAD', '--', ...executionFiles]).status === 0 && executionFiles.every(file => git(['cat-file', '-e', `${repo.commit}:${file}`]).status === 0), 'Backfill execution files must be unchanged and committed.');
  return repo;
}
function parseOptions() {
  ensure(['plan', 'apply', 'verify'].includes(action), 'Use plan, apply or verify. No migration/deployment action exists.');
  const result = {};
  while (args.length) {
    const name = args.shift();
    ensure(['--backup', '--plan', '--expected-products', '--confirm-catalog-writes-paused'].includes(name) && !Object.hasOwn(result, name), 'Unknown or duplicate option.');
    if (name === '--confirm-catalog-writes-paused') result[name] = true;
    else { ensure(args[0] && !args[0].startsWith('--'), 'Missing option value.'); result[name] = args.shift(); }
  }
  ensure(result['--backup'] && result['--plan'], '--backup and --plan are required.');
  return result;
}
try {
  const options = parseOptions();
  const repo = immutableRelease();
  const expectedProducts = Number(options['--expected-products'] || '13');
  ensure(Number.isSafeInteger(expectedProducts) && expectedProducts > 0 && expectedProducts <= 100_000, 'Invalid reviewed product count.');
  const planFile = path.resolve(root, options['--plan']);
  const privateDirectory = path.join(root, '.joro-live');
  ensure(path.dirname(planFile) === privateDirectory && /^[a-zA-Z0-9_.-]+\.json$/.test(path.basename(planFile)), 'Plan must be a JSON file directly under .joro-live.');
  ensure(!fs.lstatSync(privateDirectory).isSymbolicLink() && (!fs.existsSync(planFile) || !fs.lstatSync(planFile).isSymbolicLink()), 'Private plan paths must not be links.');
  ensure(git(['check-ignore', '--quiet', '--', planFile]).status === 0 && !git(['ls-files', '--', planFile]).stdout.trim(), 'Private plans must be ignored and untracked.');
  const backup = verifiedBackup(options['--backup']);
  stage = 'fixed live profile and managed tunnel verification';
  const raw = readLiveUrl(root); // Explicit fixed production profile; inherited DATABASE_URL is not used.
  const tunnel = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/verify-live-audit-tunnel.ps1')], { encoding: 'utf8', windowsHide: true });
  ensure(tunnel.status === 0 && JSON.parse(tunnel.stdout).verified === true, 'Authorized managed SSH tunnel is not verified.');
  const { PrismaClient } = await import('@prisma/client');
  db = new PrismaClient({ datasourceUrl: raw });
  const history = await inspectDatabase(db, repo.migrations, repo.legacyMigrations, value => { stage = value; });
  ensure(history.pending.length === 0, 'Migration history is not ready: apply only approved migrations before planning/backfill.');
  stage = 'slug column and full unique index verification';
  const columns = await db.$queryRawUnsafe("SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'");
  const indexes = await db.$queryRawUnsafe("SELECT COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND INDEX_NAME='product_slug_key' ORDER BY SEQ_IN_INDEX");
  ensure(columns.length === 1 && columns[0].COLUMN_TYPE.toLowerCase() === 'varchar(191)' && columns[0].IS_NULLABLE === 'YES', 'Expected nullable product.slug VARCHAR(191) is missing.');
  ensure(indexes.length === 1 && indexes[0].COLUMN_NAME === 'slug' && Number(indexes[0].NON_UNIQUE) === 0 && Number(indexes[0].SEQ_IN_INDEX) === 1 && indexes[0].SUB_PART == null, 'Expected full unique product_slug_key is missing.');
  const triggers = await db.$queryRawUnsafe("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='product'");
  ensure(triggers.length === 0, 'Product triggers require separate review before a backfill can preserve unrelated data.');
  const context = { database: `${TARGET.DB_HOST}:${TARGET.DB_PORT}/${TARGET.DB_NAME}`, commit: repo.commit, digest: repo.digest, backup, expectedProducts };
  if (action === 'plan') {
    const plan = createLiveSlugPlan(await db.product.findMany(liveProductOrder), context);
    const fd = fs.openSync(planFile, 'wx', 0o600);
    try { securePrivateFile(planFile); fs.writeFileSync(fd, JSON.stringify(plan, null, 2) + '\n'); } finally { fs.closeSync(fd); }
    console.log(`Live plan saved privately: ${plan.products} products; ${plan.assignments.length} assignments. No production writes. Review the plan before apply.`);
  } else {
    const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    validateLivePlanContext(plan, context);
    if (action === 'apply') {
      ensure(options['--confirm-catalog-writes-paused'] === true, 'Explicit Product-writer quiescence confirmation is required.');
      ensure(process.stdin.isTTY && process.stdout.isTTY, 'Live backfill requires interactive approval; no noninteractive bypass is accepted.');
      const io = createInterface({ input: process.stdin, output: process.stdout });
      try {
        ensure((await io.question(`Type BACKUP VERIFIED ${TARGET.DB_NAME} after independently verifying production origin and isolated restoration: `)).trim() === `BACKUP VERIFIED ${TARGET.DB_NAME}`, 'Backup restoration attestation missing. Nothing applied.');
        const phrase = `BACKFILL ${TARGET.DB_NAME} ${repo.commit.slice(0, 12)} ${expectedProducts}`;
        ensure((await io.question(`Type ${phrase} to apply the reviewed private plan: `)).trim() === phrase, 'Backfill approval did not match. Nothing applied.');
      } finally { io.close(); }
      const current = immutableRelease();
      ensure(current.commit === repo.commit && current.digest === repo.digest && verifiedBackup(backup.file).hash === backup.hash, 'Release or backup changed during approval.');
      ensure((await inspectDatabase(db, repo.migrations, repo.legacyMigrations)).pending.length === 0, 'Migration history changed during approval.');
      stage = 'approved transactional backfill';
      const result = await applyLiveSlugPlan(db, plan, context);
      console.log(JSON.stringify({ ...result, releaseCommit: repo.commit, backupHash: backup.hash }));
    } else {
      stage = 'read-only exact coverage and product integrity verification';
      console.log(JSON.stringify(verifyLiveSlugRows(await db.product.findMany(liveProductOrder), plan, context)));
    }
  }
} catch (error) {
  // Never print raw Prisma/driver errors, plans, secret values or datasource URLs.
  console.error('Live slug operation stopped at ' + stage + '. ' + (error instanceof LiveSafetyError ? error.message : 'Plan, database or integrity verification failed. No further operation was attempted.'));
  process.exitCode = 1;
} finally { if (db) await db.$disconnect(); }
