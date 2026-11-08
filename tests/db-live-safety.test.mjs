import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { TARGET, LIVE_SETTINGS, PASSWORD_PLACEHOLDER, initializeConfig, readConfig, readLiveUrl, validateLiveUrl, analyzeHistory, inspectDatabase, repositoryState, verifiedBackup, safeDatabaseFailure, verifyRequestedMigration } from '../scripts/lib/live-db-safety.mjs';
import { sha256 } from '../scripts/lib/migration-tools.mjs';

const migrations = [{name:'0_baseline',sql:'baseline fixture'}, {name:'20261025000000_standalone_quote_service_booking',sql:'nullable fixture'}];
test('single-migration option narrows deployment to the exact reviewed pending name', () => {
  const slug = '20261108000000_product_readable_slug';
  assert.doesNotThrow(() => verifyRequestedMigration([slug], slug));
  assert.doesNotThrow(() => verifyRequestedMigration(['other'], undefined));
  for (const pending of [[], ['other'], [slug, 'other']]) assert.throws(() => verifyRequestedMigration(pending, slug), /single-migration restriction/);
  assert.throws(() => verifyRequestedMigration([slug], '--unsafe'), /single-migration restriction/);
});
const applied = name => ({ migration_name:name, checksum:sha256(migrations.find(m=>m.name===name).sql), finished_at:new Date(), rolled_back_at:null });
function fixtureDirectory(work) {
  const parent = path.resolve('node_modules/.cache'); fs.mkdirSync(parent,{recursive:true}); const directory=fs.mkdtempSync(path.join(parent,'joro-live-test-'));
  try { return work(directory); } finally { assert.equal(path.dirname(directory),parent); assert.ok(path.basename(directory).startsWith('joro-live-test-')); fs.rmSync(directory,{recursive:true,force:true}); }
}

// Exercise the real committed-payload guard against an isolated HEAD snapshot.
// Uses existing Git objects only: no commits, staging, production access or guard override.
function committedFixture(work) {
  return fixtureDirectory(root => {
    const git = args => { const r = spawnSync('git', args, {encoding:'utf8'}); assert.equal(r.status,0); return r.stdout.trim(); };
    const gitDir = git(['rev-parse','--absolute-git-dir']);
    const files = git(['ls-tree','-r','--name-only','HEAD','--','prisma/schema.prisma','prisma/migration-manifest.json','prisma/migrations','prisma/migrations_archive']).split('\n').filter(Boolean);
    for(const file of files) {
      assert.ok(file.startsWith('prisma/') && !file.includes('..'));
      const result = spawnSync('git',['show','HEAD:'+file]); assert.equal(result.status,0);
      const target = path.join(root,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,result.stdout);
    }
    fs.writeFileSync(path.join(root,'.git'),'gitdir: '+gitDir+'\n');
    const previous = process.env.GIT_OPTIONAL_LOCKS; process.env.GIT_OPTIONAL_LOCKS='0';
    try { return work(root); } finally { if(previous===undefined)delete process.env.GIT_OPTIONAL_LOCKS;else process.env.GIT_OPTIONAL_LOCKS=previous; }
  });
}

test('private live environment initializes with exact settings and placeholder, preserving local environments', () => fixtureDirectory(root => {
  fs.writeFileSync(path.join(root,'.env'),'DATABASE_URL=local-fixture\n'); fs.writeFileSync(path.join(root,'.env.local'),'local-settings');
  assert.deepEqual(initializeConfig(root),LIVE_SETTINGS); initializeConfig(root);
  assert.equal(fs.readFileSync(path.join(root,'.env'),'utf8'),'DATABASE_URL=local-fixture\n');
  assert.equal(fs.readFileSync(path.join(root,'.env.local'),'utf8'),'local-settings');
  const file=path.join(root,'.env.live.local'); assert.match(fs.readFileSync(file,'utf8'),/JORO_LIVE_DB_PASSWORD="ADD_MYSQL_PASSWORD_HERE"/);
  assert.throws(()=>readLiveUrl(root),/Please configure JORO_LIVE_DB_PASSWORD in .env.live.local./);
  fs.appendFileSync(file,'DATABASE_URL=forbidden\n'); assert.throws(()=>readConfig(root),/Unexpected/);
}));

test('private-file passwords load automatically, round trip special characters and never appear in public config', () => fixtureDirectory(root => {
  initializeConfig(root);
  const file=path.join(root,'.env.live.local'); const template=fs.readFileSync(file,'utf8');
  const password='fixture @#&%:/?!$=+ with spaces';
  fs.writeFileSync(file,template.replace(PASSWORD_PLACEHOLDER,password));
  const before=fs.readFileSync(file,'utf8'); initializeConfig(root);
  assert.equal(fs.readFileSync(file,'utf8'),before);
  const url=validateLiveUrl(readLiveUrl(root));
  assert.equal(decodeURIComponent(url.password),password);
  assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'3307');assert.equal(url.pathname,`/${TARGET.DB_NAME}`);
  assert.deepEqual(readConfig(root),LIVE_SETTINGS);assert.ok(!JSON.stringify(readConfig(root)).includes(password));
  for(const value of ['',PASSWORD_PLACEHOLDER]) {
    fs.writeFileSync(file,template.replace(PASSWORD_PLACEHOLDER,value));
    assert.throws(()=>readLiveUrl(root),/Please configure JORO_LIVE_DB_PASSWORD/);
  }
  fs.writeFileSync(file,template.replace('JORO_LIVE_AUTO_MIGRATE=false','JORO_LIVE_AUTO_MIGRATE=true'));
  assert.throws(()=>readConfig(root),/security settings/);
}));

test('explicit Cloudinary application keys are preserved but excluded from live connection configuration', () => fixtureDirectory(root => {
  initializeConfig(root);
  const file = path.join(root, '.env.live.local');
  const source = fs.readFileSync(file, 'utf8').replace(PASSWORD_PLACEHOLDER, 'fixture-db-password') +
    '\n# unrelated application settings\nCLOUDINARY_CLOUD_NAME="fixture-cloud"\nCLOUDINARY_API_KEY="fixture-key"\nCLOUDINARY_API_SECRET="fixture-secret # with spaces"\n';
  fs.writeFileSync(file, source);
  assert.deepEqual(readConfig(root), LIVE_SETTINGS);
  const url = readLiveUrl(root);
  assert.equal(decodeURIComponent(validateLiveUrl(url).password), 'fixture-db-password');
  for (const value of ['fixture-cloud', 'fixture-key', 'fixture-secret']) {
    assert.ok(!url.includes(value));
    assert.ok(!JSON.stringify(readConfig(root)).includes(value));
  }
  initializeConfig(root);
  assert.equal(fs.readFileSync(file, 'utf8'), source);
  for (const key of ['CLOUDINARY_URL', 'CLOUDINARY_OTHER', 'DATABASE_URL', 'JORO_LIVE_DB_OVERRIDE']) {
    fs.writeFileSync(file, source + `${key}=fixture\n`);
    assert.throws(() => readConfig(root), /Unexpected/);
    assert.equal(fs.readFileSync(file, 'utf8'), source + `${key}=fixture\n`);
  }
  for (const [key, value] of Object.entries(LIVE_SETTINGS)) {
    fs.writeFileSync(file, source.replace(`${key}=${value}`, `${key}=unsafe-fixture`));
    assert.throws(() => readConfig(root), /security settings/);
  }
  fs.writeFileSync(file, source + 'CLOUDINARY_API_SECRET=duplicate\n');
  assert.throws(() => readConfig(root), /duplicate/);
}));

test('legacy fixed profile upgrades automatically without losing an existing password', () => fixtureDirectory(root => {
  const file=path.join(root,'.env.live.local');
  const password='fixture @#&%:/?!';
  fs.writeFileSync(file,Object.entries(TARGET).map(([k,v])=>`${k}=${v}`).join('\n')+`\nDB_PASSWORD="${password}"\n`);
  initializeConfig(root);
  assert.equal(decodeURIComponent(validateLiveUrl(readLiveUrl(root)).password),password);
  assert.equal(fs.existsSync(path.join(root,'.env')),false);assert.equal(fs.existsSync(path.join(root,'.env.local')),false);
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/^DB_HOST=/m);
}));

test('special-character passwords round trip and live URLs cannot silently target local development', () => {
  const password="fixture @:/?#%+!é'\\";
  const url=`mysql://${TARGET.DB_USER}:${encodeURIComponent(password)}@127.0.0.1:3307/${TARGET.DB_NAME}?connection_limit=1`;
  assert.equal(decodeURIComponent(validateLiveUrl(url).password),password);
  for(const invalid of [url.replace(':3307/',':3306/'),url.replace(TARGET.DB_NAME,'joro_local'),url.replace('127.0.0.1','example.invalid'),url+'&schema=other']) assert.throws(()=>validateLiveUrl(invalid));
});

test('migration history requires baseline, exact checksums, contiguous history and no failed or conflicting migrations', () => {
  assert.deepEqual(analyzeHistory([applied('0_baseline')],migrations),[migrations[1].name]);
  assert.deepEqual(analyzeHistory(migrations.map(m=>applied(m.name)),migrations),[]);
  assert.throws(()=>analyzeHistory([],migrations),/baseline/);
  assert.throws(()=>analyzeHistory([{...applied('0_baseline'),checksum:'wrong'}],migrations),/checksum/);
  assert.throws(()=>analyzeHistory([{...applied('0_baseline'),finished_at:null}],migrations),/unfinished/);
  assert.throws(()=>analyzeHistory([{...applied('0_baseline'),migration_name:'unknown'}],migrations),/unknown/);
  assert.throws(()=>analyzeHistory([applied('0_baseline'),applied('0_baseline')],migrations),/Duplicate/);
  const longer=[migrations[0],{name:'20261018000000_intermediate',sql:'intermediate'},migrations[1]];
  assert.throws(()=>analyzeHistory([applied('0_baseline'),applied(migrations[1].name)],longer),/gap/);
});

test('live database checks use SELECT only and stop immediately on the wrong database identity', async () => {
  const queries=[]; let wrong=false;
  const db={ $queryRawUnsafe:async sql=> { queries.push(sql); assert.match(sql,/^SELECT /); if(sql.includes('CURRENT_USER'))return [{database_name:wrong?'joro_local':TARGET.DB_NAME,database_user:TARGET.DB_USER+'@localhost',server_port:3306}]; if(sql.includes('information_schema'))return ['customer','product','order','vendor','orderservice','_prisma_migrations'].map(table_name=>({table_name})); return [applied('0_baseline')]; }};
  assert.equal((await inspectDatabase(db,migrations)).pending.length,1); assert.equal(queries.length,3);
  wrong=true; queries.length=0; await assert.rejects(inspectDatabase(db,migrations),/identity/); assert.equal(queries.length,1);
});

test('active migration checksums remain byte-exact across line endings', () => {
  const active = [{name:'0_baseline',sql:'-- baseline\nSELECT 1;\n'}];
  const row = {...applied('0_baseline'),checksum:sha256(active[0].sql)};
  assert.deepEqual(analyzeHistory([row],active),[]);
  assert.throws(()=>analyzeHistory([{...row,checksum:sha256(active[0].sql.replace(/\n/g,'\r\n'))}],active),/checksum/);
});

test('documented archived history requires committed checksums, complete history and a later valid baseline', () => committedFixture(root => {
  const repo = repositoryState(root,true);
  assert.equal(repo.legacyMigrations.length,24);
  const start = new Date('2026-10-01T00:00:00Z');
  const end = new Date('2026-10-02T00:00:00Z');
  const baseline = {...applied('0_baseline'),started_at:new Date('2026-10-17T00:00:00Z')};
  const archive = repo.legacyMigrations.map(m => ({migration_name:m.name,checksum:sha256(m.sql),started_at:start,finished_at:end,rolled_back_at:null}));
  const retry = archive.find(r => r.migration_name === '20260914000000_step8_top_vendors');
  const original = repo.legacyMigrations.find(m => m.name === retry.migration_name).rollbackSql;
  const rollback = {...retry,checksum:sha256(original),started_at:new Date('2026-09-29T00:00:00Z'),finished_at:null,rolled_back_at:new Date('2026-09-30T00:00:00Z')};
  const rows = [rollback,...archive,baseline];
  const check = input => analyzeHistory(input,migrations,repo.legacyMigrations);
  assert.deepEqual(check(rows),[migrations[1].name]);
  assert.throws(()=>check(rows.filter(r=>r!==baseline)),/baseline/);
  assert.throws(()=>check(rows.map(r=>r===baseline?{...r,checksum:'wrong'}:r)),/baseline/);
  assert.throws(()=>check(rows.map(r=>r===archive[0]?{...r,checksum:'wrong'}:r)),/checksum/);
  assert.throws(()=>check(rows.map(r=>r===archive[0]?{...r,finished_at:null}:r)),/history/);
  assert.throws(()=>check(rows.filter(r=>r!==archive[0])),/history/);
  assert.throws(()=>check([...rows,archive[0]]),/history/);
  assert.throws(()=>check(rows.map(r=>r===archive[0]?{...r,finished_at:new Date('2026-10-18T00:00:00Z')}:r)),/post-baseline/);
  assert.throws(()=>check(rows.map(r=>r===rollback?{...r,rolled_back_at:new Date('2026-10-03T00:00:00Z')}:r)),/chronology/);
  // Both newline encodings of the authentic SQL are valid, independently for
  // each historical attempt. Active migrations still require exact bytes.
  const windowsRows = rows.map(row => {
    const entry = repo.legacyMigrations.find(m => m.name === row.migration_name);
    if (!entry) return row;
    const sql = row.rolled_back_at ? entry.rollbackSql : entry.sql;
    return {...row,checksum:sha256(sql.replace(/\r\n/g,'\n').replace(/\n/g,'\r\n'))};
  });
  assert.deepEqual(check(windowsRows),[migrations[1].name]);
  assert.throws(()=>check(rows.map(r=>r===rollback?{...r,checksum:retry.checksum}:r)),/checksum/);
  assert.throws(()=>check(rows.map(r=>r===retry?{...r,checksum:rollback.checksum}:r)),/checksum/);
  assert.throws(()=>check(rows.map(r=>r===rollback?{...r,checksum:'wrong'}:r)),/checksum/);
  assert.throws(()=>analyzeHistory(rows,migrations,repo.legacyMigrations.map(m=>({...m,sql:m.sql+' '}))),/checksum/);
  assert.throws(()=>analyzeHistory(rows,migrations,repo.legacyMigrations.map(m=>({...m,sql:m.sql.replace(/\n/g,' \n')}))),/checksum/);
  assert.throws(()=>analyzeHistory(rows,migrations,repo.legacyMigrations.map(m=>({...m,rollbackSql:undefined}))),/checksum/);
  for(const name of ['20261014000000_coupon_system','20261028000000_unknown']) assert.throws(()=>check([...rows,{...archive[0],migration_name:name}]),/unknown/);
  assert.throws(()=>check([...rows,{...applied(migrations[1].name),checksum:'wrong'}]),/checksum/);
  assert.throws(()=>check([...rows,{...applied(migrations[1].name),finished_at:null}]),/unfinished/);
}));

test('backup gate fingerprints a real nonempty file; committed repository history is consistent', () => fixtureDirectory(root=>{
  const file=path.join(root,'backup.sql');fs.writeFileSync(file,'isolated backup fixture');
  assert.equal(verifiedBackup(file).hash,sha256('isolated backup fixture'));
  assert.throws(()=>verifiedBackup(path.join(root,'missing')),/backup/);
  committedFixture(snapshot => {
    assert.ok(repositoryState(snapshot,true).commit);
    fs.appendFileSync(path.join(snapshot,'prisma/schema.prisma'),'\n// uncommitted edit\n');
    assert.throws(()=>repositoryState(snapshot,true),/unchanged, committed/);
  });
}));

test('environment/state files are ignored and every live npm command points to an implemented action', () => {
  for(const file of ['.env.live.local','.env.live.backup','.joro-live/tunnel.json','.joro-live/known_hosts','.joro-live/last-check.json']) assert.equal(spawnSync('git',['check-ignore','--quiet',file]).status,0);
  assert.notEqual(spawnSync('git',['check-ignore','--quiet','.env.live.example']).status,0);
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  for(const name of ['setup','connect','check','status','disconnect','deploy','validate','tunnel']) { assert.match(pkg.scripts['db:live:'+name],/scripts\/db-live\.ps1 -Action /); }
  assert.equal(pkg.scripts.dev,'node scripts/dev-local.mjs'); assert.equal(pkg.scripts.build,'node scripts/build.mjs');
  const ps=fs.readFileSync('scripts/db-live.ps1','utf8'); assert.doesNotMatch(ps,/DPAPI|SecureString|Read-LiveCredential/); assert.match(ps,/StrictHostKeyChecking=ask/); assert.doesNotMatch(ps,/StrictHostKeyChecking=(no|accept-new)/);
  assert.ok(ps.indexOf('& node $nodeTool credentials-check') < ps.indexOf('$record = Start-ManagedTunnel'));
  const node=fs.readFileSync('scripts/db-live.mjs','utf8'); assert.match(node,/process\.stdin\.isTTY/); assert.match(node,/BACKUP VERIFIED/); assert.match(node,/migrate','deploy'/); assert.doesNotMatch(node,/migrate','(?:dev|reset|resolve)'|db','push'/);
});

test('driver diagnostics report failure classes without exposing driver messages or URLs', () => {
  const fixtureSecret = 'mysql://fixture:private@example.invalid/db';
  for(const [code,pattern] of [['P1000',/authentication rejected/],['P1001',/unreachable/],['P1002',/timed out/],['P1003',/does not exist/],['P1010',/lacks access/],['P1011',/TLS/],['P1013',/URL format/],['UNKNOWN',/unclassified/]]) {
    const message=safeDatabaseFailure({code,message:fixtureSecret,stack:fixtureSecret});
    assert.match(message,pattern); assert.ok(!message.includes(fixtureSecret));
  }
  assert.match(safeDatabaseFailure({errorCode:'P1000'}),/authentication/);
  assert.match(safeDatabaseFailure({code:'P2010',meta:{code:'1142',message:fixtureSecret}}),/read-only metadata/);
  for (const code of ['ERR_USE_AFTER_CLOSE','ABORT_ERR','EPIPE']) {
    const message=safeDatabaseFailure({code,message:fixtureSecret});
    assert.match(message,/approval input closed/); assert.ok(!message.includes(fixtureSecret));
  }
});

test('live preflight cannot migrate and failed approval/backup paths stop before any migrating command', async () => {
  const require=createRequire(import.meta.url), file='scripts/db-live.mjs', name='20261108000000_product_readable_slug';
  for(const scenario of ['preflight','bad-backup','no-tty','closed-backup-input','closed-migration-input']) {
    const commands=[],logs=[]; let questions=0;
    const state={argv:['node',file,scenario==='preflight'?'preflight':'deploy','--backup','fixture.sql.gz','--only-migration',name],env:{DATABASE_URL:'forbidden-local'},stdin:{isTTY:scenario!=='no-tty'},stdout:{isTTY:true},exitCode:0};
    const modules={
      './lib/live-db-safety.mjs':{TARGET,LiveSafetyError: (await import('../scripts/lib/live-db-safety.mjs')).LiveSafetyError,ensure:(ok,msg)=>{if(!ok)throw new (require('../scripts/lib/live-db-safety.mjs').LiveSafetyError)(msg);},readConfig:()=>({}),readLiveUrl:()=> 'mysql://fixture:private-value@127.0.0.1/fixture',repositoryState:()=>({commit:'a'.repeat(40),digest:'digest',migrations:[{name,sql:'reviewed fixture SQL'}],legacyMigrations:[]}),inspectDatabase:async()=>({database:'fixture',user:'fixture',applied:[],pending:[name]}),verifiedBackup:()=>{if(scenario==='bad-backup')throw Object.assign(new Error('private-value'),{code:'ENOENT'});return {file:'fixture.sql.gz',hash:'hash'};},safeDatabaseFailure,verifyRequestedMigration},
      'node:fs':{existsSync:()=>true,writeFileSync(){}},
      'node:child_process':{spawnSync:(_bin,args)=>{commands.push(args);assert.equal(args[1],'deploy-preflight','No migrating subprocess is permitted in this test');return {status:0};}},
      'node:readline/promises':{createInterface:()=>({close(){},question:async()=>{questions++;if(scenario==='closed-migration-input'&&questions===1)return `BACKUP VERIFIED ${TARGET.DB_NAME}`;throw Object.assign(new Error('private-value'),{code:'ERR_USE_AFTER_CLOSE'});}})},
      '@prisma/client':{PrismaClient:class{async $disconnect(){}}},
    };
    let source=fs.readFileSync(file,'utf8').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(path.resolve(file)).href));
    source=source.replace('main().catch(error => {','await main().catch(error => {');
    const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    await runInNewContext('(async()=>{'+js+'})()',{exports:{},require:id=>modules[id]||require(id),process:state,console:{log:value=>logs.push(value),error:value=>logs.push(value)},URL});
    assert.equal(commands.length,1);
    assert.equal(state.exitCode,scenario==='preflight'?0:1);
    assert.ok(!logs.join('\n').includes('private-value'));
    if(scenario==='preflight'){assert.equal(questions,0);assert.match(logs.join('\n'),/No migration was attempted/);}
    if(scenario.startsWith('closed-'))assert.match(logs.join('\n'),/approval input closed/);
  }
});

test('Next development startup rejects an inherited production URL without connecting', () => {
  const result=spawnSync(process.execPath,['scripts/dev-local.mjs','--check'],{encoding:'utf8',env:{...process.env,DATABASE_URL:`mysql://${TARGET.DB_USER}:fixture@127.0.0.1:3307/${TARGET.DB_NAME}`}});
  assert.equal(result.status,1); assert.match(result.stderr,/unsafe/); assert.doesNotMatch(result.stderr,/mysql:\/\//);
  const local=spawnSync(process.execPath,['scripts/dev-local.mjs','--check'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'mysql://fixture:fixture@127.0.0.1:3306/joro_local'}});
  assert.equal(local.status,0,local.stderr);
});

test('PowerShell syntax and process-ownership guards reject stale/reused/unrelated process identifiers', {skip:process.platform!=='win32'}, () => {
  const source=String.raw`
    $ErrorActionPreference='Stop'
    $tokens=$null; $issues=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/db-live.ps1'),[ref]$tokens,[ref]$issues)
    if($issues.Count){throw 'PowerShell syntax failed'}
    $functions=$ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true)
    foreach($definition in $functions){Invoke-Expression $definition.Extent.Text}
    if(Test-OwnedTunnel $null){throw 'Null state was trusted'}
    if(Test-OwnedTunnel ([pscustomobject]@{Token='invalid'})){throw 'Invalid owner token was trusted'}
    $script:stopped=0; $script:listenerOwner=90001; $managedScriptPath='C:\fixture\db-live.ps1'
    $script:token=[guid]::NewGuid().ToString(); $script:started=[DateTime]::UtcNow
    function Stop-Process {param($Id,$ErrorAction) if($Id -ne 90001){throw 'Wrong process'}; $script:stopped++}
    function Get-Process {param($Id,$ErrorAction) if($Id -ne 90001){throw 'Unrelated process'}; return [pscustomobject]@{ProcessName='ssh';StartTime=$script:started}}
    function Get-CimInstance {param($ClassName,$Filter) if($Filter.Contains('90001')){return [pscustomobject]@{ParentProcessId=90002;CommandLine='ssh 127.0.0.1:3307:127.0.0.1:3306 u749284283@145.79.26.151'}};return [pscustomobject]@{CommandLine=($managedScriptPath+' '+$script:token)}}
    function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction) return [pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=$script:listenerOwner}}
    $record=[pscustomobject]@{Token=$script:token;SshPid=90001;SessionPid=90002;StartTicks=$script:started.ToUniversalTime().Ticks.ToString()}
    if(!(Test-OwnedTunnel $record)){throw 'Valid managed process rejected'}
    if(!(Test-OwnedListener $record)){throw 'Valid managed listener rejected'}
    $record.StartTicks='1'; if(Test-OwnedTunnel $record){throw 'Reused PID was trusted'}
    $record.StartTicks=$script:started.ToUniversalTime().Ticks.ToString();$script:listenerOwner=90003
    if(Test-OwnedListener $record){throw 'Unrelated listener was trusted'}
    $stateFile=Join-Path $PSScriptRoot 'state.json'
    $record | ConvertTo-Json | Set-Content -LiteralPath $stateFile
    Stop-OwnedTunnel
    if($script:stopped -ne 1){throw 'Owned SSH process was not stopped exactly once'}
    Stop-OwnedTunnel
    if($script:stopped -ne 1){throw 'An unrelated process was terminated'}
    Write-Output 'PowerShell ownership guards passed'
  `;
  fixtureDirectory(root => { const script=path.join(root,'guards.ps1');fs.writeFileSync(script,source);const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script],{encoding:'utf8'}); assert.equal(result.status,0,result.stderr); });
});
