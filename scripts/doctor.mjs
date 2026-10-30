// Read-only health check of this checkout: tools, Git, dependencies, environment, local database and the
// private live profile. It never writes files or databases, never connects to the live database and never
// prints secrets or connection strings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import nextEnv from '@next/env';
import { assertDevelopmentDatabase } from './lib/migration-tools.mjs';
import { readConfig } from './lib/live-db-safety.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = ['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'VENDOR_JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const OPTIONAL = { Email: ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'], Cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] };
let failures = 0, warnings = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => { warnings++; console.log(`  ! ${msg}`); };
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };
/** Reports `good` when `pass` holds, otherwise reports `bad` at the given level (fail by default). */
const check = (pass, good, bad, level = fail) => { if (pass) ok(good); else level(bad); };
const run = (cmd, args, options = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60_000, ...options });
const section = (title) => console.log(`\n${title}`);

section('Tools');
ok(`Node ${process.version}`);
const npm = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['-v'], { shell: process.platform === 'win32' });
check(npm.status === 0, `npm ${npm.stdout.trim()}`, 'npm is not available.');

section('Git');
const git = (...args) => run('git', args);
const branch = git('branch', '--show-current').stdout.trim();
const head = git('rev-parse', 'HEAD').stdout.trim();
ok(`Branch ${branch || '(detached)'} at ${head.slice(0, 12)}`);
const remote = git('ls-remote', 'origin', 'refs/heads/main');
const remoteHead = remote.status === 0 ? remote.stdout.split(/\s/)[0] : '';
if (!remoteHead) warn('Could not reach origin/main (offline?).');
else if (remoteHead === head) ok('Matches origin/main.');
else warn(`Differs from origin/main (${remoteHead.slice(0, 12)}). Run git pull if you expect the latest code.`);
const changed = git('status', '--porcelain').stdout.split('\n').filter((line) => line && !line.includes('public/uploads/'));
check(!changed.length, 'No uncommitted changes outside public/uploads.', `${changed.length} uncommitted change(s) outside public/uploads.`, warn);

section('Dependencies');
try {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  let checked = 0; const drift = [];
  for (const [name, info] of Object.entries(lock.packages)) {
    if (!name.startsWith('node_modules/') || name.split('node_modules/').length > 2 || info.optional) continue;
    checked++;
    try { if (JSON.parse(fs.readFileSync(path.join(root, name, 'package.json'), 'utf8')).version !== info.version) drift.push(name); }
    catch { drift.push(name); }
  }
  check(!drift.length, `${checked} packages match package-lock.json.`, `${drift.length} of ${checked} packages differ from package-lock.json (e.g. ${drift.slice(0, 3).join(', ')}). Run npm ci.`);
} catch { fail('package-lock.json or node_modules is missing. Run npm ci.'); }

section('Environment (names only)');
const { loadedEnvFiles } = nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });
check(loadedEnvFiles.length > 0, `Loaded ${loadedEnvFiles.map((f) => f.path).join(', ')}`, 'No .env file found.');
const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
check(!missing.length, `Required settings present: ${REQUIRED.join(', ')}`, `Missing: ${missing.join(', ')}`);
for (const [feature, keys] of Object.entries(OPTIONAL)) {
  const empty = keys.filter((key) => !process.env[key]?.trim());
  check(!empty.length, `${feature} configured.`, `${feature} not configured (${empty.join(', ')}); that feature will not work locally.`, warn);
}

section('Local database');
let localTarget = null;
try { localTarget = assertDevelopmentDatabase(process.env.DATABASE_URL, process.env); ok(`DATABASE_URL points to local ${localTarget.host} / ${localTarget.database}.`); }
catch (error) { fail(error.message); }
if (localTarget) {
  const status = run(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'status'], { env: process.env });
  const output = `${status.stdout}${status.stderr}`;
  if (/Database schema is up to date/.test(output)) ok('Connected; all migrations applied.');
  else if (/not yet been applied|following migration/i.test(output)) warn('Connected; some migrations are pending. Run npm run db:migrate.');
  else if (/P1001|Can't reach/.test(output)) fail('Local MySQL is not reachable. Start the MySQL service.');
  else if (/P1000|Authentication failed/.test(output)) fail('Local MySQL rejected the username or password in DATABASE_URL.');
  else fail('Could not read migration status from the local database.');
}
const manifest = run(process.execPath, [path.join(root, 'scripts/db-migrations.mjs'), 'check']);
check(manifest.status === 0, 'Migrations match schema.prisma and the manifest.', 'Migration manifest check failed. Run npm run db:check for details.');

section('Live profile (offline, no connection)');
if (!fs.existsSync(path.join(root, '.env.live.local'))) warn('.env.live.local not found; run npm run db:live:setup if you need live access.');
else {
  try { readConfig(root); ok('.env.live.local matches the approved live settings.'); }
  catch (error) { fail(error.code === 'EACCES' || error.code === 'EPERM' ? '.env.live.local is not readable from this terminal.' : error.message); }
}

console.log(`\n${failures ? `✗ ${failures} problem(s)` : '✓ All checks passed'}${warnings ? `, ${warnings} warning(s)` : ''}.`);
process.exitCode = failures ? 1 : 0;
