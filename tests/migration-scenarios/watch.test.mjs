// Watcher test for `scripts/db-migrations.mjs dev-server`: a stub replaces `next dev`, the schema is a
// scratch copy under node_modules/.cache, and the database is disposable (MIGRATION_TEST_SERVER_URL).
//   node tests/migration-scenarios/watch.test.mjs
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const WATCH = join(ROOT, "node_modules/.cache/joro-watch");
const CLIENT = join(ROOT, "node_modules/.cache/joro-test-client-watch");
const F = join(WATCH, "prisma"), SCH = join(F, "schema.prisma"), PIDS = join(WATCH, "stub-pids.txt");
const PRISMA = join(ROOT, "node_modules/prisma/build/index.js");
const url = (name) => execFileSync(process.execPath, [join(HERE, "db-url.mjs"), name], { env: process.env }).toString();
const dropDb = () => spawnSync(process.execPath, [PRISMA, "db", "execute", "--stdin", "--url", url("server")], { input: "DROP DATABASE IF EXISTS joro_disposable_watch;", stdio: ["pipe", "ignore", "ignore"] });
const dirs = () => readdirSync(join(F, "migrations")).filter((n) => n !== "migration_lock.toml");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
let failed = 0;
const ok = (cond, label) => { console.log(`    ${cond ? "PASS" : "FAIL"}: ${label}`); if (!cond) failed++; };

rmSync(WATCH, { recursive: true, force: true });
rmSync(CLIENT, { recursive: true, force: true });
mkdirSync(F, { recursive: true });
for (const p of ["migrations", "migration-manifest.json"]) cpSync(join(ROOT, "prisma", p), join(F, p), { recursive: true });
const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8").split("\r\n").join("\n");
writeFileSync(SCH, schema.replace('provider = "prisma-client-js"', `provider = "prisma-client-js"\n  output   = "${CLIENT.split("\\").join("/")}"`));
dropDb();

// The stub records each start so the test can verify every instance is stopped at the end.
const stub = [process.execPath, "-e", `require("fs").appendFileSync(${JSON.stringify(PIDS)}, process.pid + "\\n"); console.log("STUB SERVER UP"); setInterval(() => {}, 1000)`];
const child = spawn(process.execPath, ["scripts/db-migrations.mjs", "dev-server", "--schema", SCH], {
  cwd: ROOT, env: { ...process.env, DATABASE_URL: url("joro_disposable_watch"), JORO_DEV_COMMAND: JSON.stringify(stub) },
});
let out = "";
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => (out += d));
const waitFor = async (pred, ms, label) => { const end = Date.now() + ms; while (Date.now() < end) { if (pred()) return true; await sleep(250); } console.log(`    (timeout waiting for ${label})`); return false; };
const count = (re) => (out.match(re) || []).length;

console.log("=== startup");
ok(await waitFor(() => /Watching/.test(out), 300000, "watching"), "startup cycle ran, stub server started, watcher active");
ok(count(/STUB SERVER UP/g) === 1, "one server instance");
const before = dirs().length;

console.log("=== two rapid saves 300 ms apart");
appendFileSync(SCH, '\nmodel WatchItem {\n  id   String @id @default(cuid())\n\n  @@map("watchitem")\n}\n');
await sleep(300);
writeFileSync(SCH, readFileSync(SCH, "utf8").replace("  id   String @id @default(cuid())\n\n  @@map(\"watchitem\")", "  id   String @id @default(cuid())\n  label String? @db.VarChar(80)\n\n  @@map(\"watchitem\")"));
ok(await waitFor(() => count(/STUB SERVER UP/g) >= 2 && /Migration .* applied/.test(out), 300000, "restart"), "server paused, migration applied, server restarted");
await sleep(3000);
const created = dirs().slice(before);
ok(created.length === 1, `exactly one migration for both saves (${created.join(", ") || "none"})`);
ok(created.length === 1 && /CREATE TABLE `watchitem`[\s\S]*`label`/.test(readFileSync(join(F, "migrations", created[0], "migration.sql"), "utf8")), "the migration contains both edits");
ok(count(/schema\.prisma changed; pausing/g) === 1, "one cycle for the burst of saves");
ok(!/Another migration process/.test(out), "no overlapping migration processes");

console.log("=== a comment-only save does not migrate");
appendFileSync(SCH, "\n// just a comment\n");
await sleep(6000);
ok(dirs().length === before + 1, "no migration for a comment");

console.log("=== shutdown");
if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
else child.kill("SIGTERM");
await waitFor(() => child.exitCode !== null || child.signalCode !== null, 15000, "dev-server exit");
await sleep(1000);
const stubPids = existsSync(PIDS) ? readFileSync(PIDS, "utf8").split("\n").filter(Boolean).map(Number) : [];
ok(stubPids.length >= 2 && stubPids.every((pid) => !alive(pid)), `every stub server instance stopped (${stubPids.length} started)`);

dropDb();
console.log("--- dev-server log (filtered):");
console.log(out.split("\n").filter((l) => /^\[db\]|STUB|Applying/.test(l)).map((l) => `      ${l}`).join("\n"));
rmSync(CLIENT, { recursive: true, force: true });
rmSync(WATCH, { recursive: true, force: true });
console.log(failed ? "SOME WATCH CHECKS FAILED" : "ALL WATCH CHECKS PASSED");
process.exit(failed ? 1 : 0);
