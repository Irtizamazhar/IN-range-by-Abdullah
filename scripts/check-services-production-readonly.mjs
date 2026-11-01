// Metadata audit only. No write SQL, arbitrary SQL, migration application or deployment branch exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readLiveUrl, repositoryState, inspectDatabase, safeDatabaseFailure, ensure } from './lib/live-db-safety.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const QUERIES = Object.freeze({
  version: 'SELECT VERSION() AS version, @@version_comment AS flavor, @@lower_case_table_names AS lower_case_table_names, @@default_storage_engine AS default_engine, @@innodb_page_size AS innodb_page_size',
  tables: "SELECT TABLE_NAME AS name, ENGINE AS engine, ROW_FORMAT AS row_format, TABLE_COLLATION AS collation, DATA_LENGTH AS data_bytes, INDEX_LENGTH AS index_bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('serviceoffering','servicecatalog','servicelocationrequest','customer','vendor','product','order','orderservice') ORDER BY TABLE_NAME",
  columns: "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS default_value, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'serviceoffering' ORDER BY ORDINAL_POSITION",
  indexes: "SELECT INDEX_NAME AS name, NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS position, COLUMN_NAME AS column_name, SUB_PART AS prefix_length FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'serviceoffering' ORDER BY INDEX_NAME, SEQ_IN_INDEX",
  states: 'SELECT moderationStatus AS status, COUNT(*) AS count FROM serviceoffering GROUP BY moderationStatus',
  counts: 'SELECT (SELECT COUNT(*) FROM customer) AS customers, (SELECT COUNT(*) FROM vendor) AS vendors, (SELECT COUNT(*) FROM product) AS products, (SELECT COUNT(*) FROM serviceoffering) AS services, (SELECT COUNT(*) FROM orderservice) AS bookings, (SELECT COUNT(*) FROM `order`) AS orders',
});
const historyQueries = [
  'SELECT DATABASE() AS database_name, CURRENT_USER() AS database_user, @@port AS server_port',
  'SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
  'SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM `_prisma_migrations` ORDER BY started_at, id',
];
export function assertAuditQuery(sql) {
  ensure([...Object.values(QUERIES), ...historyQueries].includes(sql), 'Query is not in the fixed read-only audit allowlist.');
  return sql;
}
export function diffArgs(from, to) {
  return ['migrate', 'diff', '--from-schema-datasource', from, '--to-schema-datamodel', to, '--exit-code'];
}
function diff(from, to, url) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...diffArgs(from, to)], {
    cwd: root, windowsHide: true, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, DATABASE_URL: url, JORO_DEPLOY_MIGRATIONS: 'false' },
  });
  ensure([0, 2].includes(result.status), 'Read-only schema comparison failed; raw driver output withheld.');
  return { changed: result.status === 2, summary: result.stdout.replace(/mysql:\/\/\S+/g, '[redacted URL]').trim() };
}
export async function main() {
  process.env.JORO_DEPLOY_MIGRATIONS = 'false';
  ensure(process.argv.length === 2, 'This read-only audit accepts no action or SQL arguments.');
  const repo = repositoryState(root, false); // Inspection of the working-tree proposal, never a deployable artifact.
  const url = readLiveUrl(root); // Retains the exact profile/host/database/user restrictions.
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasourceUrl: url });
  const query = sql => db.$queryRawUnsafe(assertAuditQuery(sql));
  const report = { checkedAt: new Date().toISOString(), migrationsEnabled: false, auditOnly: true, workingTreeDigest: repo.digest };
  try {
    const history = await inspectDatabase({ $queryRawUnsafe: query }, repo.migrations, repo.legacyMigrations);
    report.identityVerified = true;
    report.history = { applied: history.applied, archivedRows: history.archivedRows, pending: history.pending, tableCount: history.tableCount };
    report.server = (await query(QUERIES.version))[0];
    for (const key of ['tables','columns','indexes','states','counts']) report[key] = await query(QUERIES[key]);
    const previous = spawnSync('git', ['show','HEAD:prisma/schema.prisma'], { cwd: root, windowsHide: true });
    ensure(previous.status === 0, 'Committed pre-change schema unavailable.');
    const directory = path.join(root, 'node_modules/.cache/joro-services-readonly');
    fs.mkdirSync(directory, { recursive: true });
    const from = path.join(directory, 'previous-schema.prisma');
    fs.writeFileSync(from, previous.stdout); // Schema only; no private URL is stored in this file.
    report.baselineDrift = diff(from, from, url);
    report.proposedSchemaDiff = diff(from, path.join(root, 'prisma/schema.prisma'), url);
    ensure(repositoryState(root, false).digest === repo.digest, 'Working-tree proposal changed during the audit; rerun inspection.');
    const text = JSON.stringify(report, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
    fs.writeFileSync(path.join(root, 'docs/SERVICES_PRODUCTION_READONLY_RESULT.json'), text);
    console.log(text);
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error('Read-only audit stopped: ' + (error?.name === 'LiveSafetyError' ? error.message : safeDatabaseFailure(error))); process.exitCode = 1; });
}
