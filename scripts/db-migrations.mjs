#!/usr/bin/env node
// JORO.pk Prisma migration workflow. See docs/DATABASE_MIGRATIONS.md.
//
//   migrate           One development cycle: apply committed migrations, generate a migration
//                     for schema changes, apply it if safe, regenerate the client, update the manifest.
//                     --name <name>  migration name   --approve  apply a migration awaiting approval
//                     --discard      delete an unapplied migration awaiting approval
//   dev-server        migrate, then run `next dev` and repeat the cycle whenever schema.prisma changes.
//                     Arguments after `--` go to next dev. SKIP_DB_MIGRATE=1 skips the database work.
//   check             Fail if schema.prisma or prisma/migrations differ from prisma/migration-manifest.json.
//                     --ref <git-ref>  check a commit instead of the working tree (used by the pre-push hook)
//                     --full           also replay every migration into a temporary local database
//   deploy-preflight  Production build checks before `prisma migrate deploy` (run by scripts/build.mjs when
//                     JORO_DEPLOY_MIGRATIONS=true, or by npm run build:deploy).
//
// Development commands only ever touch a local database; they never reset, push or resolve anything.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, watchFile, unwatchFile } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  analyzeMigrationSql, assertDevelopmentDatabase, buildManifest, checkManifest, checkMigrationLayout,
  isEmptyMigration, schemaFingerprint, sha256, suggestMigrationName,
} from "./lib/migration-tools.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_CLI = join(ROOT, "node_modules", "prisma", "build", "index.js");
const STATE_DIR = join(ROOT, "node_modules", ".cache", "joro-migrations");
const TEMP_NAME = "joro_auto_pending";
const NOISE = /deprecated and will be removed in Prisma 7|pris\.ly\/prisma-config|^Environment variables loaded|^Prisma schema loaded|Update available|npm i --save-dev prisma|npm i @prisma\/client|─|│|^\s*$/;

class WorkflowError extends Error {}

// ---------- arguments ----------
const argv = process.argv.slice(2);
const command = argv[0];
const passthrough = argv.includes("--") ? argv.slice(argv.indexOf("--") + 1) : [];
const own = argv.includes("--") ? argv.slice(1, argv.indexOf("--")) : argv.slice(1);
const flag = (name) => own.includes(name);
const option = (name) => (own.includes(name) ? own[own.indexOf(name) + 1] : undefined);
const SCHEMA = resolve(ROOT, option("--schema") || "prisma/schema.prisma");
const PRISMA_DIR = dirname(SCHEMA);
const MIGRATIONS_DIR = join(PRISMA_DIR, "migrations");
const MANIFEST = join(PRISMA_DIR, "migration-manifest.json");

// ---------- helpers ----------
const log = (msg = "") => console.log(`[db] ${msg}`);
const printOutput = (text) => {
  for (const line of String(text || "").split(/\r?\n/)) if (!NOISE.test(line)) console.log(`     ${line}`);
};

function prisma(args, { env = process.env, input, withSchema = true } = {}) {
  const full = withSchema ? [...args, "--schema", SCHEMA] : args;
  const res = spawnSync(process.execPath, [PRISMA_CLI, ...full], {
    cwd: ROOT, env, encoding: "utf8", input,
    // stdin is never a terminal, so Prisma can never ask to reset a database.
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  return { code: res.status ?? 1, out: `${res.stdout || ""}${res.stderr || ""}` };
}

function git(args) {
  const res = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return { code: res.status ?? 1, out: (res.stdout || "").trim(), err: (res.stderr || "").trim() };
}
const inGitRepo = () => git(["rev-parse", "--is-inside-work-tree"]).out === "true";
const repoPath = (abs) => relative(ROOT, abs).split("\\").join("/");

function listMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((n) => statSync(join(MIGRATIONS_DIR, n)).isDirectory())
    .sort()
    .map((name) => {
      const file = join(MIGRATIONS_DIR, name, "migration.sql");
      return { name, sql: existsSync(file) ? readFileSync(file, "utf8") : null };
    });
}

function readWorkingTree() {
  const lockFile = join(MIGRATIONS_DIR, "migration_lock.toml");
  return {
    schemaText: readFileSync(SCHEMA, "utf8"),
    lockText: existsSync(lockFile) ? readFileSync(lockFile, "utf8") : null,
    migrations: listMigrations(),
    manifest: existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null,
  };
}

function readGitRef(ref) {
  const show = (p) => { const r = git(["show", `${ref}:${p}`]); return r.code === 0 ? r.out + "\n" : null; };
  const raw = (p) => { const r = spawnSync("git", ["show", `${ref}:${p}`], { cwd: ROOT, encoding: "utf8" }); return r.status === 0 ? r.stdout : null; };
  const dir = repoPath(MIGRATIONS_DIR);
  const schemaText = raw(repoPath(SCHEMA));
  if (schemaText === null) throw new WorkflowError(`Cannot read ${repoPath(SCHEMA)} at ${ref}.`);
  const tree = git(["ls-tree", "--name-only", `${ref}:${dir}`]);
  const names = tree.code === 0 ? tree.out.split("\n").filter(Boolean) : [];
  const manifestText = show(repoPath(MANIFEST));
  return {
    schemaText,
    lockText: names.includes("migration_lock.toml") ? show(`${dir}/migration_lock.toml`) : null,
    migrations: names.filter((n) => n !== "migration_lock.toml").sort().map((name) => ({ name, sql: raw(`${dir}/${name}/migration.sql`) })),
    manifest: manifestText ? JSON.parse(manifestText) : null,
  };
}

function staticErrors(source) {
  return [...checkMigrationLayout(source), ...checkManifest(source.manifest, source.schemaText, source.migrations.filter((m) => m.sql !== null))];
}

function writeManifest() {
  const { schemaText, migrations } = readWorkingTree();
  const next = `${JSON.stringify(buildManifest(schemaText, migrations), null, 2)}\n`;
  const prev = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf8") : "";
  if (next !== prev) writeFileSync(MANIFEST, next);
  return next !== prev;
}

function gitAdd(paths) {
  if (!inGitRepo()) return;
  const inside = paths.filter((p) => !relative(ROOT, p).startsWith(".."));
  if (inside.length && git(["add", "--", ...inside.map(repoPath)]).code === 0)
    log(`Staged for commit: ${inside.map(repoPath).join(", ")}`);
}

// Loads the local development database URL the same way Next.js does (.env.local, then .env).
function developmentEnv() {
  if (!process.env.DATABASE_URL) {
    for (const file of [".env.local", ".env"]) {
      const path = join(ROOT, file);
      if (existsSync(path)) dotenv.config({ path, quiet: true });
    }
  }
  const target = assertDevelopmentDatabase(process.env.DATABASE_URL, process.env);
  return { env: { ...process.env }, target };
}

// ---------- single-process lock ----------
function withLock(fn) {
  mkdirSync(STATE_DIR, { recursive: true });
  const lock = join(STATE_DIR, "migrate.lock");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      closeSync(openSync(lock, "wx"));
      writeFileSync(lock, String(process.pid));
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const pid = Number(readFileSync(lock, "utf8")) || 0;
      let alive = false;
      try { if (pid) { process.kill(pid, 0); alive = pid !== process.pid; } } catch { alive = false; }
      if (alive) throw new WorkflowError(`Another migration process (pid ${pid}) is running. Wait for it to finish.`);
      unlinkSync(lock);
      if (attempt === 1) throw new WorkflowError("Could not acquire the migration lock.");
    }
  }
  try { return fn(); } finally { try { unlinkSync(lock); } catch { /* already gone */ } }
}

// ---------- approval state (local, untracked) ----------
const awaitingFile = () => join(STATE_DIR, `awaiting-${sha256(SCHEMA).slice(0, 12)}.json`);
function readAwaiting() {
  if (!existsSync(awaitingFile())) return null;
  const state = JSON.parse(readFileSync(awaitingFile(), "utf8"));
  return existsSync(join(MIGRATIONS_DIR, state.name, "migration.sql")) ? state : (clearAwaiting(), null);
}
function writeAwaiting(state) { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(awaitingFile(), JSON.stringify(state, null, 2)); }
function clearAwaiting() { try { unlinkSync(awaitingFile()); } catch { /* none */ } }
const migrationSql = (name) => readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
const isTracked = (dir) => inGitRepo() && git(["ls-files", "--error-unmatch", repoPath(dir)]).code === 0;

function discardAwaiting(state, reason) {
  const dir = join(MIGRATIONS_DIR, state.name);
  if (isTracked(dir)) throw new WorkflowError(`${state.name} is tracked by Git; it will not be deleted automatically.`);
  rmSync(dir, { recursive: true, force: true });
  clearAwaiting();
  log(`Discarded unapplied migration ${state.name} (${reason}).`);
}

function reportAwaiting(state) {
  log("");
  log(`STOPPED: migration ${state.name} needs your approval before it is applied.`);
  for (const r of state.risks) log(`  [${r.level}] ${r.statement}\n         ${r.reason}`);
  log(`Review or edit: ${repoPath(join(MIGRATIONS_DIR, state.name, "migration.sql"))}`);
  log("Approve and apply it:   npm run db:migrate:approve");
  log("Or discard it:          npm run db:migrate -- --discard   (then change schema.prisma)");
  log("Nothing was applied to the database.");
}

// ---------- the development cycle ----------
function applyAndRecord(names) {
  const { env } = developmentEnv();
  const deployed = prisma(["migrate", "deploy"], { env });
  if (deployed.code !== 0) {
    printOutput(deployed.out);
    throw new WorkflowError("Applying the migration to the development database failed. Nothing else was changed; fix the SQL or the schema and run npm run db:migrate again.");
  }
  printOutput(deployed.out.split("\n").filter((l) => /Applying migration|applied|No pending/i.test(l)).join("\n"));
  generateClient();
  writeManifest();
  gitAdd([...names.map((n) => join(MIGRATIONS_DIR, n)), MANIFEST]);
}

function generateClient() {
  const res = prisma(["generate"]);
  if (res.code !== 0) {
    printOutput(res.out);
    throw new WorkflowError(/EPERM/.test(res.out)
      ? "Prisma Client could not be regenerated because another process (usually a running dev server) is using it. Stop it and run npm run db:migrate, or use npm run dev, which restarts the server for you."
      : "prisma generate failed.");
  }
  log("Prisma Client regenerated.");
}

const migrationLabel = (name, sql) =>
  (name || suggestMigrationName(sql)).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "schema_update";

/** Writes the data-losing change as an unapplied migration and stops for approval. */
function stageForApproval(env, prismaWarnings, name) {
  const diff = prisma(["migrate", "diff", "--from-url", env.DATABASE_URL, "--to-schema-datamodel", SCHEMA, "--script"], { withSchema: false });
  if (diff.code !== 0 || isEmptyMigration(diff.out)) {
    printOutput(diff.out);
    throw new WorkflowError("Prisma reported possible data loss but the migration SQL could not be generated. Nothing was applied.");
  }
  const sql = diff.out.split("\n").filter((l) => !NOISE.test(l) || /^\s*$/.test(l)).join("\n").trim() + "\n";
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const finalName = `${stamp}_${migrationLabel(name, sql)}`;
  mkdirSync(join(MIGRATIONS_DIR, finalName), { recursive: true });
  writeFileSync(join(MIGRATIONS_DIR, finalName, "migration.sql"), sql);
  log(`Generated migration ${finalName}.`);
  const risks = [
    ...prismaWarnings.map((w) => ({ level: "destructive", statement: "Prisma warning", reason: w })),
    ...analyzeMigrationSql(sql),
  ];
  const state = { name: finalName, risks, schema: schemaFingerprint(readFileSync(SCHEMA, "utf8")), sql: sha256(sql) };
  writeAwaiting(state);
  reportAwaiting(state);
  return "awaiting";
}

function migrateCycle({ approve = false, discard = false, name } = {}) {
  return withLock(() => {
    const { env, target } = developmentEnv();
    log(`Development database: ${target.database} on ${target.host}`);
    const layout = checkMigrationLayout(readWorkingTree());
    if (layout.length) throw new WorkflowError(layout.join("\n"));

    let awaiting = readAwaiting();
    if (awaiting && discard) { discardAwaiting(awaiting, "requested"); return "discarded"; }
    if (discard) { log("No migration is awaiting approval."); return "discarded"; }
    if (awaiting && approve) {
      log(`Applying approved migration ${awaiting.name}.`);
      applyAndRecord([awaiting.name]);
      clearAwaiting();
      awaiting = null;
    } else if (approve) log("No migration is awaiting approval.");
    if (awaiting) {
      const schemaMoved = awaiting.schema !== schemaFingerprint(readFileSync(SCHEMA, "utf8"));
      const untouched = awaiting.sql === sha256(migrationSql(awaiting.name));
      if (schemaMoved && untouched) discardAwaiting(awaiting, "schema.prisma changed again; regenerating");
      else { reportAwaiting(awaiting); return "awaiting"; }
    }

    const status = prisma(["migrate", "status"], { env });
    if (/not found locally/i.test(status.out))
      throw new WorkflowError(
        `The database "${target.database}" has migration history that is not in prisma/migrations.\n` +
        "This happens when the database still has the archived pre-baseline history, when a teammate's migration was\n" +
        "removed, or when a migration folder was renamed after being applied. Nothing was changed.\n" +
        "For a database with the old history, follow \"Local databases created before the baseline\" in docs/DATABASE_MIGRATIONS.md.");
    if (/failed/i.test(status.out) && status.code !== 0) {
      printOutput(status.out);
      throw new WorkflowError("A migration previously failed on this database. Fix it first (see Recovery in docs/DATABASE_MIGRATIONS.md); nothing was changed.");
    }

    const before = new Set(listMigrations().map((m) => m.name));
    const created = prisma(["migrate", "dev", "--create-only", "--name", TEMP_NAME, "--skip-generate", "--skip-seed"], { env });
    const appliedExisting = /Applying migration/.test(created.out);
    if (created.code !== 0) {
      for (const m of listMigrations()) if (!before.has(m.name)) rmSync(join(MIGRATIONS_DIR, m.name), { recursive: true, force: true });
      // Prisma refuses (instead of prompting) when the change would lose data that exists in the development
      // database. It has already checked for drift at that point, so the database matches the migrations and
      // the difference to schema.prisma is exactly the migration that needs approval.
      const warnings = created.out.split("\n").filter((l) => /^\s*•/.test(l)).map((l) => l.replace(/^\s*•\s*/, "").trim());
      if (/non-interactive/i.test(created.out) && warnings.length) return stageForApproval(env, warnings, name);
      printOutput(created.out);
      throw new WorkflowError(/drift/i.test(created.out)
        ? "Drift detected: the development database was changed outside the migrations. Nothing was reset or changed. Inspect the differences above, then either revert the manual change or capture it in schema.prisma."
        : "Prisma could not compute the migration; see the output above. Nothing was applied.");
    }
    if (appliedExisting) printOutput(created.out.split("\n").filter((l) => /Applying migration/.test(l)).join("\n"));

    const fresh = listMigrations().filter((m) => !before.has(m.name));
    for (const m of fresh.filter((f) => isEmptyMigration(f.sql || ""))) rmSync(join(MIGRATIONS_DIR, m.name), { recursive: true, force: true });
    const real = fresh.filter((f) => !isEmptyMigration(f.sql || ""));

    if (!real.length) {
      const manifestOk = checkManifest(readWorkingTree().manifest, readFileSync(SCHEMA, "utf8"), listMigrations()).length === 0;
      if (appliedExisting || !manifestOk) generateClient();
      if (writeManifest()) gitAdd([MANIFEST]);
      log(appliedExisting ? "Applied committed migrations; schema.prisma needs no new migration." : "No schema changes need a migration. Database is up to date.");
      return "in-sync";
    }

    const generated = real[0];
    const stamp = generated.name.split("_")[0];
    const finalName = `${stamp}_${migrationLabel(name, generated.sql)}`;
    if (finalName !== generated.name) renameSync(join(MIGRATIONS_DIR, generated.name), join(MIGRATIONS_DIR, finalName));
    log(`Generated migration ${finalName}.`);

    const risks = analyzeMigrationSql(generated.sql);
    if (risks.length) {
      const state = { name: finalName, risks, schema: schemaFingerprint(readFileSync(SCHEMA, "utf8")), sql: sha256(generated.sql) };
      writeAwaiting(state);
      reportAwaiting(state);
      return "awaiting";
    }
    applyAndRecord([finalName]);
    log(`Migration ${finalName} applied. Commit schema.prisma, prisma/migrations/${finalName}/ and prisma/migration-manifest.json together.`);
    return "migrated";
  });
}

// ---------- commands ----------
function runMigrate() {
  const result = migrateCycle({ approve: flag("--approve"), discard: flag("--discard"), name: option("--name") });
  process.exitCode = result === "awaiting" ? 3 : 0;
}

function runCheck() {
  const ref = option("--ref");
  // --full --update-manifest records the manifest only after the replay below proves the migrations produce schema.prisma.
  const updating = flag("--update-manifest");
  if (updating && (ref || !flag("--full"))) throw new WorkflowError("--update-manifest requires --full and cannot be combined with --ref.");
  const source = ref ? readGitRef(ref) : readWorkingTree();
  const errors = updating ? checkMigrationLayout(source) : staticErrors(source);
  if (errors.length) {
    console.error(`[db] Migration check failed${ref ? ` for ${ref}` : ""}:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  log(updating
    ? `Migration layout passed: ${source.migrations.length} migrations. Replaying them before recording the manifest.`
    : `Migration check passed${ref ? ` for ${ref}` : ""}: ${source.migrations.length} migrations match schema.prisma.`);
  if (!flag("--full")) return;

  if (!process.env.MIGRATION_CHECK_DATABASE_URL) developmentEnv();
  const base = process.env.MIGRATION_CHECK_DATABASE_URL || process.env.DATABASE_URL;
  assertDevelopmentDatabase(base, process.env);
  const temp = `joro_migcheck_${Date.now()}`;
  const server = new URL(base); server.pathname = "/";
  const tempUrl = new URL(base); tempUrl.pathname = `/${temp}`;
  const env = { ...process.env, DATABASE_URL: tempUrl.toString() };
  try {
    const deployed = prisma(["migrate", "deploy"], { env });
    if (deployed.code !== 0) { printOutput(deployed.out); throw new WorkflowError("Replaying the migrations into an empty database failed."); }
    const diff = prisma(["migrate", "diff", "--from-url", tempUrl.toString(), "--to-schema-datamodel", SCHEMA, "--exit-code"], { withSchema: false });
    if (diff.code !== 0) { printOutput(diff.out); throw new WorkflowError("The migrations do not produce schema.prisma. Run npm run db:migrate to generate the missing migration."); }
    log("Full check passed: replaying all migrations into an empty database produces schema.prisma exactly.");
    if (updating && writeManifest()) { gitAdd([MANIFEST]); log("Recorded prisma/migration-manifest.json."); }
  } finally {
    prisma(["db", "execute", "--stdin", "--url", server.toString()], { withSchema: false, input: `DROP DATABASE IF EXISTS \`${temp}\`;` });
  }
}

async function runDeployPreflight() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new WorkflowError("DATABASE_URL is not set in the deployment environment (Hostinger environment variables). Deployment stopped.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new WorkflowError("DATABASE_URL is not a valid URL. Deployment stopped."); }
  if (parsed.protocol !== "mysql:") throw new WorkflowError("DATABASE_URL must use mysql://. Deployment stopped.");
  const source = readWorkingTree();
  const errors = staticErrors(source);
  if (errors.length) throw new WorkflowError(`Committed migrations do not match schema.prisma:\n  - ${errors.join("\n  - ")}\nDeployment stopped before any database change.`);
  // Read-only: an existing database must have 0_baseline recorded, or migrate deploy would try to run it.
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasourceUrl: url });
  let tables, baseline;
  try {
    tables = Number((await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'"))[0].n);
    const history = Number((await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '_prisma_migrations'"))[0].n);
    baseline = history ? Number((await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM `_prisma_migrations` WHERE migration_name = '0_baseline' AND finished_at IS NOT NULL AND rolled_back_at IS NULL"))[0].n) : 0;
  } catch {
    throw new WorkflowError("Cannot connect to the database with DATABASE_URL. Deployment stopped before any database change.");
  } finally {
    await db.$disconnect();
  }
  if (tables > 0 && !baseline)
    throw new WorkflowError("This database already has tables but 0_baseline is not recorded as applied. Running migrate deploy would try to recreate them. Complete the one-time baseline in docs/DATABASE_MIGRATIONS.md first. Deployment stopped before any database change.");
  log(`Deployment preflight passed: ${source.migrations.length} committed migrations match schema.prisma; database reachable; ${tables ? "baseline recorded" : "empty database"}. Applying committed migrations next.`);
}

function runDevServer() {
  const nextBin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const childCommand = process.env.JORO_DEV_COMMAND ? JSON.parse(process.env.JORO_DEV_COMMAND) : [process.execPath, nextBin, "dev", ...passthrough];
  const skip = process.env.SKIP_DB_MIGRATE === "1";
  let child = null, busy = false, again = false, timer = null, lastHash = sha256(readFileSync(SCHEMA));

  const start = () => {
    child = spawn(childCommand[0], childCommand.slice(1), { cwd: ROOT, stdio: "inherit", env: process.env });
    log(`Dev server started (pid ${child.pid}).`);
  };
  const stop = () => new Promise((done) => {
    if (!child || child.exitCode !== null) return done();
    child.once("exit", () => done());
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  });
  const cycle = (label) => {
    try {
      const result = migrateCycle();
      if (result === "awaiting") log("Dev server keeps running with the previous Prisma Client until the migration is approved.");
      return true;
    } catch (e) {
      console.error(`[db] ${label} stopped: ${e.message}`);
      return false;
    }
  };
  const onSchemaChange = async () => {
    const hash = sha256(readFileSync(SCHEMA));
    if (hash === lastHash) return;
    if (busy) { again = true; return; }
    busy = true; lastHash = hash;
    log("schema.prisma changed; pausing the dev server to update the database.");
    await stop();
    cycle("Schema update");
    start();
    busy = false;
    if (again) { again = false; onSchemaChange(); }
  };

  if (skip) log("SKIP_DB_MIGRATE=1: not checking or migrating the database.");
  else if (!cycle("Startup")) { process.exitCode = 1; return; }
  start();
  if (!skip) {
    watchFile(SCHEMA, { interval: 500 }, () => { clearTimeout(timer); timer = setTimeout(onSchemaChange, 800); });
    log(`Watching ${repoPath(SCHEMA)} for changes.`);
  }
  const shutdown = async () => { unwatchFile(SCHEMA); clearTimeout(timer); await stop(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  child.on("exit", (code) => { if (!busy) { unwatchFile(SCHEMA); process.exit(code ?? 0); } });
}

try {
  if (command === "migrate") runMigrate();
  else if (command === "check") runCheck();
  else if (command === "deploy-preflight") await runDeployPreflight();
  else if (command === "dev-server") runDevServer();
  else { console.error("Usage: node scripts/db-migrations.mjs <migrate|dev-server|check|deploy-preflight>"); process.exitCode = 2; }
} catch (e) {
  console.error(`[db] ${e instanceof WorkflowError ? e.message : e.stack || e.message}`);
  process.exitCode = 1;
}
