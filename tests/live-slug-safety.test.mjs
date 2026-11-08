import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ensure, LiveSafetyError, safeDatabaseFailure } from '../scripts/lib/live-db-safety.mjs';
import { classifyCatalogDrift } from '../scripts/lib/classify-catalog-drift.mjs';
const require = createRequire(import.meta.url);
const { planProductSlugs, catalogFingerprint } = require('../lib/product-slug-plan.ts');
async function inspect({ tunnel = true, tampered = false, diffStatus = 0 } = {}) {
  const logs = [], queries = [], commands = [];
  const state = { argv: ['node', 'read-only-audit'], env: {}, exitCode: 0 };
  const writes = new Map();
  let connected = false;
  const sql = fs.readFileSync('prisma/migrations/20261108000000_product_readable_slug/migration.sql', 'utf8');
  const modules = {
    'node:fs': { readFileSync: () => Buffer.from('private fixture profile'), mkdirSync() {}, existsSync: () => false, writeFileSync: (file, contents) => writes.set(file, contents) },
    'node:child_process': { spawnSync: (file, args, options) => {
      commands.push(args);
      if (file === 'git') return { status: 0, stdout: '' };
      if (file === 'powershell.exe') return { status: tunnel ? 0 : 1, stdout: JSON.stringify({ verified: tunnel }) };
      assert.equal(args[1], 'migrate'); assert.equal(args[2], 'diff');
      assert.ok(!args.some(arg => String(arg).includes('never-print-password')));
      assert.equal(options.env.RUST_LOG, 'info');
      return { status: diffStatus, stdout: diffStatus === 2 ? '-- do not apply fixture differences' : '-- empty', stderr: '' };
    } },
    './lib/live-db-safety.mjs': {
      ensure, LiveSafetyError, safeDatabaseFailure,
      readLiveUrl: () => 'mysql://fixture:never-print-password@127.0.0.1:3307/fixture',
      repositoryState: (_root, committed) => committed
        ? { commit: '1358fde96e77e39c2ef05cff6026edae6381b2e7', migrations: [], legacyMigrations: [] }
        : { migrations: [{ name: '20261108000000_product_readable_slug', sql: tampered ? sql + 'DELETE FROM product;' : sql }] },
      inspectDatabase: async () => ({ pending: [], applied: [] }),
    },
    './lib/migration-tools.mjs': { prismaCliEnvironment: env => ({ ...env, RUST_LOG: 'info' }) },
    './lib/classify-catalog-drift.mjs': { classifyCatalogDrift },
    '../lib/product-slug-plan.ts': { planProductSlugs, catalogFingerprint },
    '@prisma/client': { PrismaClient: class {
      constructor() { connected = true; }
      async $disconnect() {}
      async $queryRawUnsafe(query) {
        assert.match(query, /^SELECT /); queries.push(query);
        if (query.includes('SELECT id, name')) return Array.from({ length: 13 }, (_, i) => ({ id: 'fixture-' + i, name: 'Private fixture title', updatedAt: new Date(0) }));
        if (query.includes('VERSION()')) return [{ version: '11.8.9-MariaDB', provider_comment: 'MariaDB Server' }];
        if (query.includes('TABLE_COLLATION')) return [{ ENGINE: 'InnoDB', ROW_FORMAT: 'Dynamic', TABLE_COLLATION: 'utf8mb4_unicode_ci' }];
        return [];
      }
    } },
  };
  const source = fs.readFileSync('scripts/check-live-slug-safety.mjs', 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path.resolve('scripts/check-live-slug-safety.mjs')).href));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  await runInNewContext('(async()=>{' + js + '})()', { exports: {}, require: name => modules[name] || require(name), process: state, console: { log: value => logs.push(value), error: value => logs.push(value) }, URL });
  const report = JSON.parse(Array.from(writes).find(([file]) => file.endsWith('report.json'))[1]);
  assert.ok(!logs.join('\n').includes('never-print-password'));
  assert.ok(!logs.join('\n').includes('Private fixture title'));
  return { report, connected, queries, commands, state };
}
test('inspection previews all 13 products and only invokes SELECT plus read-only Prisma diff', async () => {
  const result = await inspect();
  assert.equal(result.report.preview.assignments, 13);
  assert.equal(result.report.preview.uniqueSlugs, 13);
  assert.equal(result.report.preview.writes, 0);
  assert.equal(result.report.drift.status, 'no modeled drift');
  assert.match(result.report.verdict, /NO-GO/); // No backup attestation can be invented.
});
test('changed migration SQL is rejected before connection', async () => {
  const result = await inspect({ tampered: true });
  assert.equal(result.connected, false); assert.equal(result.queries.length, 0);
  assert.match(result.report.error, /differs/);
});
test('unverified tunnel prevents all production queries', async () => {
  const result = await inspect({ tunnel: false });
  assert.equal(result.connected, false); assert.equal(result.queries.length, 0);
});
test('detected schema drift is reported as a blocker, never applied', async () => {
  const result = await inspect({ diffStatus: 2 });
  assert.match(result.report.drift.status, /drift detected/);
  assert.match(result.report.verdict, /NO-GO/);
});
