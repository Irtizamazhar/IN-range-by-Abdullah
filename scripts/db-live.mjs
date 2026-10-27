// Read-only by default. The only write-capable branch is explicitly confirmed `deploy`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { TARGET, LiveSafetyError, ensure, initializeConfig, readConfig, readLiveUrl, repositoryState, inspectDatabase, verifiedBackup, safeDatabaseFailure } from './lib/live-db-safety.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const action = process.argv[2];
let stage = 'live profile and repository validation';
const onStage = value => { stage = value; console.log(`Checking: ${stage}.`); };
async function main() {
  ensure(['init','config','validate','credentials-check','check','status','deploy'].includes(action), 'Unsupported live action. Use the documented npm commands.');
  if (action === 'init') { initializeConfig(root); fs.mkdirSync(path.join(root,'.joro-live'),{ recursive:true }); console.log('Private live environment initialized. Existing local environments were not changed.'); return; }
  const config = readConfig(root);
  if (action === 'config') { console.log(JSON.stringify(config)); return; }
  if (action === 'credentials-check') { stage = 'private MySQL password configuration'; readLiveUrl(root); console.log('Live password configured and target verified. No connection attempted.'); return; }
  const repo = repositoryState(root, true);
  if (action === 'validate') { console.log('Live profile and migration manifest validated offline. No database connection attempted.'); return; }
  stage = 'in-memory connection URL validation';
  const raw = readLiveUrl(root);
  // Do not load dotenv or export this live URL to the developer's shell.
  delete process.env.DATABASE_URL;
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasourceUrl: raw });
  try {
    const before = await inspectDatabase(db,repo.migrations,repo.legacyMigrations,onStage);
    const display = info => { console.log(`Verified database: ${info.database}; expected user: ${info.user}; tables: ${info.tableCount}.`); console.log('Baseline and recorded migration checksums verified.'); console.log(`Applied migrations:\n${info.applied.map(n => `  ${n}`).join('\n')}`); console.log(info.pending.length ? `Pending migrations:\n${info.pending.map(n => `  ${n}`).join('\n')}` : 'No pending migrations.'); };
    display(before);
    const receipt = () => fs.writeFileSync(path.join(root,'.joro-live','last-check.json'),JSON.stringify({ verifiedAt:new Date().toISOString(), session:process.env.JORO_LIVE_SESSION_ID || null, ...before, action },null,2));
    if (action !== 'deploy') { receipt(); return; }
    if (!before.pending.length) { receipt(); return; }
    stage = 'existing read-only deployment preflight';
    const preflight = spawnSync(process.execPath,[path.join(root,'scripts/db-migrations.mjs'),'deploy-preflight'],{cwd:root,env:{...process.env,DATABASE_URL:raw,JORO_DEPLOY_MIGRATIONS:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});
    ensure(preflight.status === 0,'Existing deployment preflight failed. Nothing applied. Raw child output was withheld to protect credentials.');
    console.log('Existing read-only deployment preflight passed. Intended committed SQL changes:');
    for (const name of before.pending) console.log(`\n--- ${name} ---\n${repo.migrations.find(m => m.name === name).sql}`);
    ensure(process.stdin.isTTY && process.stdout.isTTY, 'Live deployment requires an interactive terminal. No noninteractive approval is accepted.');
    const index = process.argv.indexOf('--backup'); const backup = verifiedBackup(index >= 0 ? process.argv[index+1] : undefined);
    console.log(`Committed migration revision: ${repo.commit}. Backup SHA256: ${backup.hash}.`);
    console.log('Backup existence/hash is verified automatically; you must independently verify its production origin and restore usability.');
    const io = createInterface({ input:process.stdin, output:process.stdout });
    try {
      ensure((await io.question(`Type BACKUP VERIFIED ${TARGET.DB_NAME} after checking the backup: `)).trim() === `BACKUP VERIFIED ${TARGET.DB_NAME}`, 'Backup attestation was not supplied. Nothing applied.');
      const phrase = `APPLY ${TARGET.DB_NAME} ${before.pending.join(',')} ${repo.commit.slice(0,12)}`;
      ensure((await io.question(`Review the listed SQL files. To apply ONLY these committed migrations, type:\n${phrase}\n> `)).trim() === phrase, 'Migration confirmation did not match. Nothing applied.');
    } finally { io.close(); }
    ensure(repositoryState(root,true).commit === repo.commit && repositoryState(root,true).digest === repo.digest && verifiedBackup(backup.file).hash === backup.hash, 'The approved commit/migrations/backup changed. Restart the deployment review.');
    ensure(JSON.stringify((await inspectDatabase(db,repo.migrations,repo.legacyMigrations)).pending) === JSON.stringify(before.pending), 'Pending migrations changed during approval. Restart the review.');
    // Freeze the approved committed payload; subsequent working-tree edits cannot change deployed SQL.
    const snapshots = path.join(root,'.joro-live','snapshots'); fs.mkdirSync(snapshots,{recursive:true});
    const snapshot = path.join(snapshots,randomUUID()); fs.mkdirSync(snapshot);
    try {
      const files = ['prisma/schema.prisma','prisma/migrations/migration_lock.toml',...repo.migrations.map(m => `prisma/migrations/${m.name}/migration.sql`)];
      for (const file of files) {
        const result = spawnSync('git',['show',`${repo.commit}:${file}`],{cwd:root,windowsHide:true}); ensure(result.status === 0,'Cannot read the approved committed migration payload.');
        const target = path.join(snapshot,file.slice('prisma/'.length)); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,result.stdout);
      }
      const result = spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(snapshot,'schema.prisma')],{cwd:root,env:{...process.env,DATABASE_URL:raw,JORO_DEPLOY_MIGRATIONS:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});
      ensure(result.status === 0,'Prisma migrate deploy failed. Output was withheld to protect credentials. Inspect migration state with db:live:status; no repair/resolve is performed automatically.');
      const status = spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','status','--schema',path.join(snapshot,'schema.prisma')],{cwd:root,env:{...process.env,DATABASE_URL:raw,JORO_DEPLOY_MIGRATIONS:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});
      ensure(status.status === 0,'Prisma migration status verification failed after deploy. No automatic repair is attempted.');
      const after = await inspectDatabase(db,repo.migrations,repo.legacyMigrations); ensure(after.pending.length === 0,'Migration verification found unapplied migrations.'); display(after); console.log('Approved committed migration deployment verified.');
    } finally { ensure(path.dirname(snapshot) === snapshots && /^[a-f0-9-]{36}$/.test(path.basename(snapshot)),'Invalid temporary snapshot cleanup target.'); fs.rmSync(snapshot,{recursive:true,force:true}); }
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  const message = error instanceof LiveSafetyError ? error.message : safeDatabaseFailure(error);
  console.error(`Live operation stopped at stage: ${stage}. ${message}`);
  const directory = path.join(root,'.joro-live');
  if (fs.existsSync(directory)) {
    try { fs.writeFileSync(path.join(directory,'last-failure.json'),JSON.stringify({failedAt:new Date().toISOString(),action,stage,message},null,2)); } catch { /* Preserve original sanitized failure. */ }
  }
  process.exitCode = 1;
});
