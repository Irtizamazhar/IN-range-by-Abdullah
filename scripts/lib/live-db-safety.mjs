import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'dotenv';
import { checkManifest, checkMigrationLayout, sha256 } from './migration-tools.mjs';

export const TARGET = Object.freeze({ DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_NAME: 'u749284283_inrange', DB_USER: 'u749284283_inrange', SSH_HOST: '145.79.26.151', SSH_PORT: '65002', SSH_USER: 'u749284283', REMOTE_DB_HOST: '127.0.0.1', REMOTE_DB_PORT: '3306' });
export class LiveSafetyError extends Error {}
export const ensure = (condition, message) => { if (!condition) throw new LiveSafetyError(message); };

export const LIVE_SETTINGS = Object.freeze({
  JORO_LIVE_DB_HOST:TARGET.DB_HOST, JORO_LIVE_DB_PORT:TARGET.DB_PORT,
  JORO_LIVE_DB_NAME:TARGET.DB_NAME, JORO_LIVE_DB_USER:TARGET.DB_USER,
  JORO_LIVE_SSH_HOST:TARGET.SSH_HOST, JORO_LIVE_SSH_PORT:TARGET.SSH_PORT,
  JORO_LIVE_SSH_USER:TARGET.SSH_USER,
  JORO_LIVE_SSH_REMOTE_DB_HOST:TARGET.REMOTE_DB_HOST,
  JORO_LIVE_SSH_REMOTE_DB_PORT:TARGET.REMOTE_DB_PORT,
  JORO_LIVE_EXPECTED_DATABASE:TARGET.DB_NAME, JORO_LIVE_AUTO_MIGRATE:'false',
});
export const PASSWORD_PLACEHOLDER = 'ADD_MYSQL_PASSWORD_HERE';

function profileValues(file) {
  ensure(!fs.lstatSync(file).isSymbolicLink(),'Private live environment must not be a symbolic link.');
  const source = fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
  const names = new Set();
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    ensure(match && !names.has(match[1]),'Unexpected or duplicate live profile setting. No connection attempted.');
    names.add(match[1]);
  }
  const data = parse(source);
  ensure(Object.keys(data).length === names.size,'Invalid live environment syntax. No connection attempted.');
  return data;
}

function profileTemplate(password = PASSWORD_PLACEHOLDER) {
  const quote = ['"',"'",'`'].find(q => !password.includes(q));
  ensure(quote && !/[\r\n]/.test(password),'Existing password cannot be safely reformatted automatically. Original file preserved.');
  return `# ==========================================\n# JORO.PK LIVE DATABASE\n# PRIVATE - NEVER COMMIT\n# ==========================================\n\nJORO_LIVE_DB_HOST=127.0.0.1\nJORO_LIVE_DB_PORT=3307\nJORO_LIVE_DB_NAME=u749284283_inrange\nJORO_LIVE_DB_USER=u749284283_inrange\nJORO_LIVE_DB_PASSWORD=${quote}${password}${quote}\n\n# ==========================================\n# HOSTINGER SSH TUNNEL\n# ==========================================\n\nJORO_LIVE_SSH_HOST=145.79.26.151\nJORO_LIVE_SSH_PORT=65002\nJORO_LIVE_SSH_USER=u749284283\n\nJORO_LIVE_SSH_REMOTE_DB_HOST=127.0.0.1\nJORO_LIVE_SSH_REMOTE_DB_PORT=3306\n\n# ==========================================\n# CONNECTION SECURITY\n# ==========================================\n\nJORO_LIVE_EXPECTED_DATABASE=u749284283_inrange\nJORO_LIVE_AUTO_MIGRATE=false\n`;
}

export function safeDatabaseFailure(error) {
  const code = String(error?.errorCode || error?.code || '');
  const databaseCode = String(error?.meta?.code || '');
  if (['EACCES','EPERM'].includes(code)) return 'Private file access denied. Run the live command from your own Windows terminal and review its NTFS permissions.';
  if (code === 'ENOENT') return 'Required local configuration or tool file is missing. Run db:live:setup and check installed project dependencies.';
  if (code === 'P1000' || databaseCode === '1045') return 'MySQL authentication rejected. Check JORO_LIVE_DB_PASSWORD in .env.live.local.';
  if (code === 'P1001') return 'MySQL endpoint unreachable through the SSH tunnel. Check SSH authentication and forwarding to remote 127.0.0.1:3306.';
  if (code === 'P1002' || code === 'P1008' || code === 'P2024') return 'MySQL connection/query timed out. Check tunnel health and server availability.';
  if (code === 'P1003' || databaseCode === '1049') return 'The configured production database does not exist on this MySQL server.';
  if (code === 'P1010' || ['1044','1142','1143'].includes(databaseCode)) return 'MySQL user lacks access to the database or required read-only metadata.';
  if (code === 'P1011') return 'MySQL TLS negotiation failed.';
  if (code === 'P1013') return 'Prisma rejected the connection URL format. Password characters must be URL-encoded.';
  if (databaseCode === '1146') return 'Required MySQL migration metadata table is missing.';
  if (databaseCode === '1054') return 'Required MySQL migration metadata column is missing.';
  return 'Database operation failed with an unclassified driver error. Raw error details were withheld to protect credentials.';
}

// Only the 24 recorded migrations documented in DATABASE_MIGRATIONS.md.
// The eight later archive entries were applied manually and are not history.
const legacyNames = `20260403140000_add_reviews
20260407120000_drop_is_new_arrival
20260411180000_add_product_is_best_seller
20260412120000_vendor_product_original_price
20260416000000_vendor_shop_processing_status
20260417120000_vendor_shop_drop_processing_status
20260911000000_vendor_suspension_fields
20260913000000_joro_marketplace_foundation
20260913010000_joro_foundation_integrity
20260913020000_database_catalog
20260913030000_customer_stores_wants
20260913040000_after_sales_workflows
20260913050000_admin_rbac_audit
20260913060000_customer_account_controls
20260913070000_product_warranties
20260913080000_customer_notifications
20260913090000_joro_merge_reconciliation
20260913100000_legacy_marketplace_reconciliation
20260914000000_step8_top_vendors
20260915000000_step9_support_tickets
20260915010000_customer_oauth_vendor_onboarding
20260916000000_vendor_operational_onboarding
20261009000000_want_request_type
20261009010000_service_listing_moderation`.split('\n');

function archivedHistory(root) {
  return legacyNames.map(name => {
    const file = `prisma/migrations_archive/${name}/migration.sql`;
    const result = spawnSync('git', ['show', `HEAD:${file}`], { cwd:root, windowsHide:true });
    ensure(result.status === 0 && spawnSync('git', ['diff','--quiet','HEAD','--',file], {cwd:root,windowsHide:true}).status === 0, 'Archived migration must match its committed SQL.');
    const entry = { name, sql:result.stdout.toString('utf8') };
    if (name === '20260914000000_step8_top_vendors') {
      // The documented rolled-back attempt used the original SQL, including
      // review.withdrawn. The successful retry used the current archived SQL.
      // Pin the original Git object; never accept arbitrary historical versions.
      const original = spawnSync('git', ['show', '3fdd16fef210341b6acd0066356d9d7bcc402a93:prisma/migrations/20260914000000_step8_top_vendors/migration.sql'], { cwd:root, windowsHide:true });
      ensure(original.status === 0, 'Authentic archived rollback SQL is unavailable. Historical review required.');
      entry.rollbackSql = original.stdout.toString('utf8');
    }
    return entry;
  });
}

export function initializeConfig(root) {
  const file = path.join(root, '.env.live.local');
  if (!fs.existsSync(file)) fs.writeFileSync(file,profileTemplate(),{flag:'wx',mode:0o600});
  else {
    const previous = profileValues(file);
    if (Object.hasOwn(previous,'DB_HOST')) {
      ensure(Object.entries(TARGET).every(([k,v]) => previous[k] === v) && Object.keys(previous).every(k => Object.hasOwn(TARGET,k) || ['DB_PASSWORD','JORO_LIVE_DB_PASSWORD'].includes(k)), 'Legacy live profile differs from the approved settings. Original file preserved.');
      ensure(!(previous.DB_PASSWORD && previous.JORO_LIVE_DB_PASSWORD && previous.DB_PASSWORD !== previous.JORO_LIVE_DB_PASSWORD),'Conflicting saved passwords. Original file preserved.');
      const password = previous.JORO_LIVE_DB_PASSWORD || previous.DB_PASSWORD || PASSWORD_PLACEHOLDER;
      const replacement = profileTemplate(password);
      ensure(parse(replacement).JORO_LIVE_DB_PASSWORD === password,'Password conversion failed. Original file preserved.');
      fs.writeFileSync(file,replacement,{mode:0o600});
    }
  }
  return readConfig(root);
}
export function readConfig(root) {
  const data = profileValues(path.join(root,'.env.live.local'));
  ensure(Object.keys(data).every(k => Object.hasOwn(LIVE_SETTINGS,k) || k === 'JORO_LIVE_DB_PASSWORD'),'Unexpected live profile setting. No connection attempted.');
  ensure(Object.entries(LIVE_SETTINGS).every(([k,v]) => data[k] === v) && Object.hasOwn(data,'JORO_LIVE_DB_PASSWORD'), 'Live profile differs from the approved host/database/tunnel/security settings. Stopped.');
  return {...LIVE_SETTINGS}; // Never return the password to the PowerShell config query.
}
export function readLiveUrl(root) {
  readConfig(root);
  const {JORO_LIVE_DB_PASSWORD:password} = profileValues(path.join(root,'.env.live.local'));
  ensure(password?.trim() && password.trim() !== PASSWORD_PLACEHOLDER,'Please configure JORO_LIVE_DB_PASSWORD in .env.live.local.');
  const raw = `mysql://${encodeURIComponent(TARGET.DB_USER)}:${encodeURIComponent(password)}@${TARGET.DB_HOST}:${TARGET.DB_PORT}/${TARGET.DB_NAME}?connection_limit=1&connect_timeout=10&pool_timeout=10`;
  validateLiveUrl(raw);
  return raw;
}
export function validateLiveUrl(raw) {
  let url; try { url = new URL(raw); } catch { throw new LiveSafetyError('Missing or invalid in-memory live connection URL. Use the PowerShell entry point.'); }
  ensure(url.protocol === 'mysql:' && url.hostname === TARGET.DB_HOST && url.port === TARGET.DB_PORT && url.pathname === `/${TARGET.DB_NAME}` && decodeURIComponent(url.username) === TARGET.DB_USER && !!url.password && !url.hash, 'The live connection URL does not match the approved production identity/tunnel.');
  ensure([...url.searchParams.keys()].every(k => ['connection_limit', 'connect_timeout', 'pool_timeout'].includes(k)), 'Unexpected live connection options.');
  return url;
}
export function repositoryState(root, committed = false) {
  const dir = path.join(root, 'prisma/migrations');
  let migrations = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => ({ name: d.name, sql: fs.readFileSync(path.join(dir,d.name,'migration.sql'),'utf8') })).sort((a,b) => a.name.localeCompare(b.name));
  let schema = fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8');
  let manifest = JSON.parse(fs.readFileSync(path.join(root,'prisma/migration-manifest.json'),'utf8'));
  ensure(checkMigrationLayout({ migrations, lockText: fs.readFileSync(path.join(dir,'migration_lock.toml'),'utf8') }).length === 0 && checkManifest(manifest,schema,migrations).length === 0, 'Repository migration layout/manifest does not match the schema. Stopped.');
  let commit = null;
  if (committed) {
    const git = args => spawnSync('git',args,{ cwd: root, encoding:'utf8', windowsHide:true });
    const head = git(['rev-parse','HEAD']); ensure(head.status === 0 && /^[a-f0-9]{40,64}\s*$/.test(head.stdout), 'A committed Git checkout is required for live deployment.'); commit = head.stdout.trim();
    const files = ['prisma/schema.prisma','prisma/migration-manifest.json','prisma/migrations/migration_lock.toml',...migrations.map(m => `prisma/migrations/${m.name}/migration.sql`)];
    ensure(git(['diff','--quiet','HEAD','--',...files]).status === 0 && files.every(f => git(['cat-file','-e',`${commit}:${f}`]).status === 0), 'Live deployment only accepts unchanged, committed schema/manifest/migrations.');
    const show = file => { const result = git(['show',`${commit}:${file}`]); ensure(result.status === 0,'Cannot read committed migration payload.'); return result.stdout; };
    schema = show('prisma/schema.prisma'); manifest = JSON.parse(show('prisma/migration-manifest.json'));
    migrations = migrations.map(m => ({ name:m.name, sql:show(`prisma/migrations/${m.name}/migration.sql`) }));
    ensure(checkMigrationLayout({ migrations, lockText:show('prisma/migrations/migration_lock.toml') }).length === 0 && checkManifest(manifest,schema,migrations).length === 0,'The committed migration payload/manifest is inconsistent. Nothing applied.');
  }
  return { migrations, legacyMigrations:archivedHistory(root), schema, manifest, commit, digest: sha256(JSON.stringify(manifest)) };
}
export function analyzeHistory(rows, migrations, legacyMigrations = []) {
  const expected = new Map(migrations.map(m => [m.name,sha256(m.sql)]));
  const legacy = new Map(legacyMigrations.filter(m => legacyNames.includes(m.name)).map(m => [m.name,m]));
  const historical = rows.filter(r => legacy.has(r.migration_name));
  if (historical.length) {
    const baseline = rows.filter(r => r.migration_name === '0_baseline');
    ensure(baseline.length === 1 && baseline[0].checksum === expected.get('0_baseline') && baseline[0].finished_at && !baseline[0].rolled_back_at, 'Missing or invalid production baseline; archived history cannot be accepted.');
    const time = value => value == null ? NaN : new Date(value).getTime();
    const baselineStart = time(baseline[0].started_at);
    ensure(Number.isFinite(baselineStart) && time(baseline[0].finished_at) >= baselineStart, 'Invalid baseline history timestamp.');
    for (const name of legacyNames) {
      const attempts = historical.filter(r => r.migration_name === name);
      const retry = name === '20260914000000_step8_top_vendors';
      ensure(attempts.length === (retry ? 2 : 1) && attempts.filter(r => r.finished_at && !r.rolled_back_at).length === 1 && attempts.filter(r => r.rolled_back_at && !r.finished_at).length === (retry ? 1 : 0), 'Inconsistent archived migration history: expected documented successful runs and rollback retry.');
      for (const row of attempts) {
        const entry = legacy.get(name);
        const sql = retry && row.rolled_back_at ? entry.rollbackSql : entry.sql;
        // Historical Windows deployments used CRLF while Git stores LF. Compare
        // exact hashes of these two encodings only; retain every other SQL byte.
        const lf = typeof sql === 'string' ? sql.replace(/\r\n/g,'\n') : null;
        ensure(lf !== null && [sha256(lf),sha256(lf.replace(/\n/g,'\r\n'))].includes(row.checksum), 'Archived migration checksum conflicts with committed SQL.');
        const start = time(row.started_at), end = time(row.rolled_back_at || row.finished_at);
        ensure(Number.isFinite(start) && Number.isFinite(end) && start <= end && end <= baselineStart, 'Archived migration timestamps are invalid or post-baseline.');
      }
      if (retry) ensure(time(attempts.find(r => r.rolled_back_at).rolled_back_at) <= time(attempts.find(r => !r.rolled_back_at).started_at), 'Inconsistent archived rollback retry chronology.');
    }
  }
  const applied = new Set();
  for (const row of rows) {
    if (legacy.has(row.migration_name)) continue;
    ensure(expected.has(row.migration_name), 'Live migration history contains an unknown/conflicting migration. Administrative review required.');
    ensure(row.checksum === expected.get(row.migration_name), 'Live migration checksum conflicts with the committed history.');
    ensure(!(row.finished_at && row.rolled_back_at), 'Inconsistent migration history: an attempt is both completed and rolled back.');
    if (row.rolled_back_at) continue;
    ensure(row.finished_at, 'A failed or unfinished live migration exists. Administrative review required; no automatic repair is permitted.');
    ensure(!applied.has(row.migration_name), 'Duplicate applied migration history detected.'); applied.add(row.migration_name);
  }
  ensure(applied.has('0_baseline'), 'The production baseline is not recorded as successfully applied. No baseline/history changes will be made automatically.');
  let gap = false;
  for (const m of migrations) { if (!applied.has(m.name)) gap = true; else ensure(!gap, 'Live migration history is out of order or has a gap.'); }
  return migrations.filter(m => !applied.has(m.name)).map(m => m.name);
}
export async function inspectDatabase(db, migrations, legacyMigrations = [], onStage = () => {}) {
  onStage('MySQL authentication and database identity');
  const identity = (await db.$queryRawUnsafe('SELECT DATABASE() AS database_name, CURRENT_USER() AS database_user, @@port AS server_port'))[0];
  ensure(identity?.database_name === TARGET.DB_NAME && String(identity.database_user).split('@')[0] === TARGET.DB_USER && Number(identity.server_port) === Number(TARGET.REMOTE_DB_PORT), 'Connected database/user/server identity is not the approved production target. Stopped.');
  onStage('production table metadata and read permissions');
  const tables = await db.$queryRawUnsafe('SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  const names = new Set(tables.map(t => t.table_name));
  ensure(['customer','product','order','vendor','orderservice','_prisma_migrations'].every(t => names.has(t)), 'Expected production tables or migration history are missing. No schema/history changes will be made.');
  onStage('migration history read permissions');
  const rows = await db.$queryRawUnsafe('SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM `_prisma_migrations` ORDER BY started_at, id');
  onStage('baseline, archived history, checksums and migration sequence');
  const pending = analyzeHistory(rows,migrations,legacyMigrations);
  return { database: TARGET.DB_NAME, user: TARGET.DB_USER, tableCount: tables.length, archivedRows:rows.filter(r => legacyMigrations.some(m => m.name === r.migration_name)).length, applied:rows.filter(r => r.finished_at && !r.rolled_back_at).map(r => r.migration_name), pending };
}
export function verifiedBackup(file) {
  ensure(typeof file === 'string' && fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0, 'A non-empty, independently verified database backup file is required.');
  const hash = createHash('sha256'); const buffer = Buffer.alloc(1024 * 1024); const fd = fs.openSync(file,'r');
  try { let bytes; while ((bytes = fs.readSync(fd,buffer,0,buffer.length,null)) > 0) hash.update(buffer.subarray(0,bytes)); } finally { fs.closeSync(fd); }
  return { file: path.resolve(file), hash: hash.digest('hex') };
}
