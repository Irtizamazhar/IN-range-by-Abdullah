import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { TARGET, ensure, LiveSafetyError } from '../scripts/lib/live-db-safety.mjs';
import * as core from '../scripts/lib/live-product-slug-plan.mjs';
const require = createRequire(import.meta.url);
async function run({ script = 'slugs', action = 'plan', pending = false, dirty = false, tunnel = true, tty = false, missingIndex = false, dumpFails = false } = {}) {
  const logs = [], writes = [], commands = [], connections = [], queries = [];
  let transactionCalls = 0;
  const rows = Array.from({ length: 13 }, (_, i) => ({ id: 'p' + i, name: 'Name ' + i, slug: null, updatedAt: new Date(0), price: '100', stock: 5 }));
  const commit = 'a'.repeat(40), backup = { file: path.resolve('.joro-live/backups/fixture.sql'), hash: 'b'.repeat(64) };
  const context = { database: `${TARGET.DB_HOST}:${TARGET.DB_PORT}/${TARGET.DB_NAME}`, commit, digest: 'digest', backup, expectedProducts: 13 };
  const plan = core.createLiveSlugPlan(rows, context);
  const url = `mysql://${TARGET.DB_USER}:fixture-secret@${TARGET.DB_HOST}:${TARGET.DB_PORT}/${TARGET.DB_NAME}`;
  const state = { argv: script === 'slugs' ? ['node', 'runner', action, '--backup', backup.file, '--plan', '.joro-live/fixture-plan.json', ...(action === 'apply' ? ['--confirm-catalog-writes-paused'] : [])] : ['node', 'backup', '--dump-bin', path.resolve('fixture-mariadb-dump.exe'), '--output', '.joro-live/backups/new.sql'], env: { DATABASE_URL: 'mysql://forbidden-local' }, stdin: { isTTY: tty }, stdout: { isTTY: tty }, exitCode: 0 };
  const modules = {
    'node:fs': { lstatSync: () => ({ isSymbolicLink: () => false }), existsSync: () => action !== 'plan', statSync: () => ({ isFile: () => true, size: 512 }), mkdirSync() {}, openSync: (_file, mode) => { assert.equal(mode, 'wx'); return 42; }, closeSync() {}, readFileSync: () => JSON.stringify(plan), writeFileSync: (...args) => writes.push(args) },
    'node:readline/promises': { createInterface: () => { throw new Error('Tests never approve production writes.'); } },
    'node:child_process': { spawnSync: (binary, args, options) => {
      commands.push({ binary, args, options });
      if (binary === 'git') return { status: dirty && args[0] === 'diff' ? 1 : 0, stdout: '' };
      if (binary === 'powershell.exe') return { status: tunnel ? 0 : 1, stdout: JSON.stringify({ verified: tunnel }) };
      if (args[0] === '--version') return { status: 0, stdout: 'mariadb-dump Distrib 11.8.9-MariaDB', stderr: '' };
      assert.equal(options.env.MYSQL_PWD, 'fixture-secret');
      assert.ok(args.includes('--single-transaction') && args.includes('--skip-lock-tables'));
      assert.ok(!args.some(value => value.includes('fixture-secret')));
      return { status: dumpFails ? 1 : 0, stderr: dumpFails ? 'private-secret-must-not-print' : '' };
    } },
    './lib/live-db-safety.mjs': {
      TARGET, ensure, LiveSafetyError,
      repositoryState: (_root, committed) => { assert.equal(committed, true); return { commit, digest: 'digest', migrations: [], legacyMigrations: [] }; },
      verifiedBackup: () => backup, readLiveUrl: () => url,
      inspectDatabase: async () => ({ pending: pending ? ['unapplied'] : [] }),
    },
    './lib/live-product-slug-plan.mjs': core,
    './lib/live-private-file.mjs': { securePrivateFile: () => {} },
    '@prisma/client': { PrismaClient: class {
      constructor(options) { assert.equal(options.datasourceUrl, url); connections.push(options); }
      async $disconnect() {}
      product = { findMany: async () => structuredClone(rows) };
      async $transaction() { transactionCalls++; throw new Error('No production writes in tests.'); }
      async $queryRawUnsafe(sql) {
        assert.match(sql, /^SELECT /); queries.push(sql);
        if (sql.includes('VERSION()')) return [{ version: '11.8.9-MariaDB' }];
        if (sql.includes('nontransactional')) return [{ nontransactional: 0n }];
        if (sql.includes('TRIGGERS')) return [];
        if (sql.includes('COLUMNS')) return [{ COLUMN_TYPE: 'varchar(191)', IS_NULLABLE: 'YES' }];
        return missingIndex ? [] : [{ COLUMN_NAME: 'slug', NON_UNIQUE: 0, SEQ_IN_INDEX: 1, SUB_PART: null }];
      }
    } },
  };
  const file = script === 'slugs' ? 'scripts/live-product-slugs.mjs' : 'scripts/live-db-backup.mjs';
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path.resolve(file)).href));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  await runInNewContext('(async()=>{' + js + '})()', { exports: {}, require: name => modules[name] || require(name), process: state, console: { log: value => logs.push(value), error: value => logs.push(value) }, URL });
  assert.ok(!logs.join('\n').includes('fixture-secret') && !logs.join('\n').includes('private-secret-must-not-print'));
  return { state, writes, connections, transactionCalls, commands, logs };
}
test('plan uses only the fixed live profile despite an inherited local DATABASE_URL', async () => {
  const result = await run(); assert.equal(result.state.exitCode, 0); assert.equal(result.connections.length, 1);
  assert.equal(JSON.parse(result.writes[0][1]).products, 13);
  assert.equal(result.transactionCalls, 0);
});
test('dirty execution files, missing tunnel, pending migration or missing unique index stop planning', async () => {
  for (const options of [{ dirty: true }, { tunnel: false }, { pending: true }, { missingIndex: true }]) {
    const result = await run(options); assert.equal(result.state.exitCode, 1); assert.equal(result.writes.length, 0); assert.equal(result.transactionCalls, 0);
  }
});
test('apply cannot bypass native interactive backup and exact-plan approval', async () => {
  const result = await run({ action: 'apply' }); assert.equal(result.state.exitCode, 1); assert.equal(result.transactionCalls, 0);
});
test('native backup uses a private output handle and password only in child environment', async () => {
  const result = await run({ script: 'backup' }); assert.equal(result.state.exitCode, 0);
  const receipt = JSON.parse(result.writes[0][1]); assert.equal(receipt.exportCompleted, true); assert.equal(receipt.isolatedRestorationVerified, false);
});
test('failed native export creates no successful backup receipt and prints no raw diagnostics', async () => {
  const result = await run({ script: 'backup', dumpFails: true }); assert.equal(result.state.exitCode, 1); assert.equal(result.writes.length, 0);
});
