import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ensure, LiveSafetyError, safeDatabaseFailure } from '../scripts/lib/live-db-safety.mjs';
const require = createRequire(import.meta.url);
async function audit({ dirty = false, tunnel = true } = {}) {
  const queries = [], logs = [], written = [];
  let connections = 0, profileReads = 0, guardCalls = 0;
  const state = { argv: ['node', 'scripts/check-live-baseline.mjs'], exitCode: 0 };
  const baseline = path.resolve('.release-prep/live-readonly-1358fde');
  const profile = Buffer.from('fake private profile for tests');
  const modules = {
    'node:fs': { readFileSync: () => profile, writeFileSync: (...args) => written.push(args) },
    'node:child_process': { spawnSync: (command, args) => {
      if (command === 'powershell.exe') return { status: tunnel ? 0 : 1, stdout: JSON.stringify({ verified: tunnel }) };
      if (args.includes('--show-toplevel')) return { status: 0, stdout: baseline };
      if (args.includes('--git-common-dir')) return { status: 0, stdout: path.resolve('.git') };
      return { status: 0, stdout: dirty ? ' M prisma/schema.prisma' : '' };
    } },
    './lib/live-db-safety.mjs': {
      ensure, LiveSafetyError, safeDatabaseFailure,
      repositoryState: (root, committed) => { assert.equal(root, baseline); assert.equal(committed, true); guardCalls++; return { commit: '1358fde96e77e39c2ef05cff6026edae6381b2e7', migrations: Array(9).fill({}), legacyMigrations: [] }; },
      readLiveUrl: () => { profileReads++; return 'mysql://fixture:never-print-this@127.0.0.1:3307/fixture'; },
      inspectDatabase: async db => { await db.$queryRawUnsafe('SELECT DATABASE()'); return { database: 'fixture', applied: ['0_baseline'], pending: ['pending-fixture'] }; },
    },
    '@prisma/client': { PrismaClient: class {
      constructor() { connections++; }
      async $queryRawUnsafe(sql) { assert.match(sql, /^SELECT /); queries.push(sql); return [{ version: 'fixture', count: 1 }]; }
      async $disconnect() {}
    } },
  };
  const source = fs.readFileSync('scripts/check-live-baseline.mjs', 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path.resolve('scripts/check-live-baseline.mjs')).href));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  await runInNewContext('(async()=>{' + js + '})()', {
    exports: {}, require: name => modules[name] || require(name), process: state,
    console: { log: value => logs.push(value), error: value => logs.push(value) },
  });
  assert.ok(!JSON.stringify([...logs, ...written]).includes('never-print-this'));
  return { state, queries, connections, profileReads, guardCalls, written };
}
test('separate baseline audit retains committed-payload guard and executes SELECT only', async () => {
  const result = await audit();
  assert.equal(result.state.exitCode, 0); assert.equal(result.guardCalls, 1);
  assert.equal(result.connections, 1); assert.equal(result.written.length, 1);
  assert.ok(result.queries.length >= 7);
});
test('dirty worktree is rejected before reading credentials or opening a connection', async () => {
  const result = await audit({ dirty: true });
  assert.equal(result.state.exitCode, 1); assert.equal(result.profileReads, 0);
  assert.equal(result.connections, 0); assert.equal(result.written.length, 0);
});
test('unverified SSH tunnel prevents every database query and connection', async () => {
  const result = await audit({ tunnel: false });
  assert.equal(result.state.exitCode, 1); assert.equal(result.connections, 0);
  assert.equal(result.queries.length, 0); assert.equal(result.written.length, 0);
});
