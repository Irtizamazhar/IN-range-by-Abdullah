// Native consistent logical export only. No migration, backfill or restore action exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { TARGET, ensure, readLiveUrl, repositoryState, inspectDatabase, verifiedBackup, LiveSafetyError } from './lib/live-db-safety.mjs';
import { securePrivateFile } from './lib/live-private-file.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let db, fd, stage = 'backup arguments and committed payload verification';
try {
  const args = process.argv.slice(2), options = {};
  while (args.length) {
    const name = args.shift();
    ensure(['--dump-bin', '--output'].includes(name) && !Object.hasOwn(options, name) && args[0] && !args[0].startsWith('--'), 'Use --dump-bin and --output exactly once.');
    options[name] = args.shift();
  }
  ensure(options['--dump-bin'] && options['--output'], '--dump-bin and --output are required.');
  const repo = repositoryState(root, true);
  const immutable = ['scripts/live-db-backup.mjs', 'scripts/lib/live-private-file.mjs', 'scripts/lib/live-db-safety.mjs', 'scripts/lib/migration-tools.mjs', 'scripts/verify-live-audit-tunnel.ps1'];
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  ensure(git(['diff', '--quiet', 'HEAD', '--', ...immutable]).status === 0 && immutable.every(file => git(['cat-file', '-e', `${repo.commit}:${file}`]).status === 0), 'Backup execution files must be unchanged and committed.');
  const binary = path.resolve(options['--dump-bin']);
  ensure(fs.statSync(binary).isFile(), 'MariaDB dump executable is missing.');
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8', windowsHide: true });
  ensure(version.status === 0 && /mariadb.*11\.8\./i.test(version.stdout + version.stderr), 'A verified MariaDB 11.8 dump client is required.');
  const destination = path.resolve(root, options['--output']);
  const directory = path.join(root, '.joro-live/backups');
  ensure(path.dirname(destination) === directory && /^[a-zA-Z0-9_.-]+\.sql$/.test(path.basename(destination)), 'Backup must be a new SQL file directly under .joro-live/backups.');
  ensure(!fs.lstatSync(path.dirname(directory)).isSymbolicLink(), 'Private backup storage must not be a link.');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  ensure(!fs.lstatSync(directory).isSymbolicLink() && git(['check-ignore', '--quiet', '--', destination]).status === 0 && !git(['ls-files', '--', destination]).stdout.trim(), 'Backup storage must be ignored, untracked and not a link.');
  stage = 'fixed production profile and authorized tunnel verification';
  const raw = readLiveUrl(root);
  const tunnel = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/verify-live-audit-tunnel.ps1')], { encoding: 'utf8', windowsHide: true });
  ensure(tunnel.status === 0 && JSON.parse(tunnel.stdout).verified === true, 'Authorized managed SSH tunnel is not verified.');
  const { PrismaClient } = await import('@prisma/client');
  db = new PrismaClient({ datasourceUrl: raw });
  await inspectDatabase(db, repo.migrations, repo.legacyMigrations, value => { stage = value; });
  const [server] = await db.$queryRawUnsafe('SELECT VERSION() AS version');
  ensure(/^11\.8\./.test(server.version) && /MariaDB/i.test(server.version), 'Verified server version differs from the reviewed MariaDB series.');
  const [engines] = await db.$queryRawUnsafe("SELECT COUNT(*) AS nontransactional FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND ENGINE <> 'InnoDB'");
  ensure(Number(engines.nontransactional) === 0, 'Nontransactional tables require a separately reviewed consistent backup method. Stop before export.');
  stage = 'native consistent production export';
  fd = fs.openSync(destination, 'wx', 0o600);
  securePrivateFile(destination);
  // Password exists only in the child environment; never in argv, SQL, output or a defaults file.
  // No --databases: the dump must not create/use the production database during isolated restoration.
  const parsed = new URL(raw);
  const result = spawnSync(binary, ['--no-defaults', '--protocol=TCP', '--host=' + TARGET.DB_HOST, '--port=' + TARGET.DB_PORT, '--user=' + TARGET.DB_USER, '--single-transaction', '--quick', '--skip-lock-tables', '--routines', '--events', '--triggers', '--hex-blob', '--default-character-set=utf8mb4', TARGET.DB_NAME], { cwd: root, env: { ...process.env, MYSQL_PWD: decodeURIComponent(parsed.password) }, stdio: ['ignore', fd, 'pipe'], windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  fs.closeSync(fd); fd = undefined;
  ensure(result.status === 0, 'Native dump failed. Partial output is NOT a verified backup; raw diagnostics were withheld. Stop and investigate.');
  const backup = verifiedBackup(destination);
  const receipt = { version: 1, createdAt: new Date().toISOString(), database: TARGET.DB_NAME, serverVersion: server.version, releaseCommit: repo.commit, file: backup.file, hash: backup.hash, bytes: fs.statSync(destination).size, exportCompleted: true, isolatedRestorationVerified: false };
  fs.writeFileSync(destination + '.receipt.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ exportCompleted: true, bytes: receipt.bytes, sha256: receipt.hash, isolatedRestorationVerified: false, next: 'Restore into an isolated MariaDB 11.8.9 server and verify scope/counts/relationships before any migration.' }));
} catch (error) {
  console.error('Live backup stopped at ' + stage + '. ' + (error instanceof LiveSafetyError ? error.message : 'Backup prerequisite or database operation failed; no migration or further operation was attempted.'));
  process.exitCode = 1;
} finally { if (fd !== undefined) fs.closeSync(fd); if (db) await db.$disconnect(); }
