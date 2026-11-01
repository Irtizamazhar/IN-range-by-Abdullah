// Local-only production HTTP/restart/release-switch smoke test. Never connects to production.
// Requires the isolated build at node_modules/.cache/joro-persistent-build.
import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const { savePublicImage } = require("../lib/public-uploads.ts");
const project = process.cwd();
const cache = path.join(project, "node_modules", ".cache");
const build = path.join(cache, "joro-persistent-build");
await fs.access(path.join(build, "BUILD_ID"));
const fixture = await fs.mkdtemp(path.join(cache, "public-http-test-"));
const storage = path.join(fixture, "durable"); await fs.mkdir(storage);
const previous = { UPLOADS_DIR: process.env.UPLOADS_DIR, NODE_ENV: process.env.NODE_ENV };
process.env.UPLOADS_DIR = storage;
process.env.NODE_ENV = "development";
const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#047857" } }).png().toBuffer();
const sha = b => createHash("sha256").update(b).digest("hex");
let child;
try {
  const image = await savePublicImage(bytes, "image/png", "categories");
  const results = [];
  for (const releaseName of ["release-one", "release-two"]) {
    const release = path.join(fixture, releaseName); await fs.mkdir(release);
    await fs.cp(build, path.join(release, ".next"), { recursive: true, filter: p => path.basename(p) !== "cache" });
    await fs.copyFile(path.join(project, "next.config.mjs"), path.join(release, "next.config.mjs"));
    await fs.copyFile(path.join(project, "package.json"), path.join(release, "package.json"));
    await fs.symlink(path.join(project, "node_modules"), path.join(release, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const legacy = path.join(release, "public", "uploads");
    await fs.mkdir(path.join(legacy, "categories"), { recursive: true });
    await fs.mkdir(path.join(legacy, "vendor-docs"), { recursive: true });
    await fs.writeFile(path.join(legacy, "categories", "legacy.png"), bytes);
    await fs.writeFile(path.join(legacy, "vendor-docs", "private.png"), bytes);
    const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    const env = { ...process.env, NODE_ENV: "production", UPLOADS_DIR: storage, JORO_DEPLOY_MIGRATIONS: "false",
      DATABASE_URL: "mysql://http_test:http_test@127.0.0.1:9/http_test", MAINTENANCE_MODE: "false",
      NEXTAUTH_SECRET: "local-http-fixture-secret-not-production-123456", NEXTAUTH_URL: `http://127.0.0.1:${port}` };
    delete env.JORO_NEXT_DIST_DIR;
    child = spawn(process.execPath, [path.join(project, "node_modules", "next", "dist", "bin", "next"), "start", release, "-H", "127.0.0.1", "-p", String(port)],
      { cwd: release, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let ready = false;
    child.stdout.on("data", data => { if (data.toString().includes("Ready in")) ready = true; });
    child.stderr.resume();
    for (let i = 0; i < 180 && !ready && child.exitCode === null; i++) await delay(250);
    assert.ok(ready, "local production server did not start");
    const base = `http://127.0.0.1:${port}`;
    for (const url of [image.url, "/uploads/categories/legacy.png"]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 200, `${releaseName} ${url}`);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(bytes));
    }
    const later = await savePublicImage(bytes, "image/png", "categories");
    assert.equal((await fetch(base + later.url)).status, 200, "runtime upload must work without restart");
    assert.equal((await fetch(base + "/uploads/vendor-docs/private.png")).status, 404, "rewrite must prevent static private-file bypass");
    assert.equal((await fetch(base + "/uploads/categories/missing.png")).status, 404);
    const customerToken = await require("next-auth/jwt").encode({ secret: env.NEXTAUTH_SECRET,
      token: { sub: "fixture-customer", role: "customer", email: "fixture@example.invalid" }, maxAge: 60 });
    for (const cookie of ["", "__Secure-next-auth.session-token.admin=invalid", `__Secure-next-auth.session-token.admin=${customerToken}`]) {
      const response = await fetch(base + "/api/admin/uploads/storage", { headers: cookie ? { Cookie: cookie } : {} });
      assert.equal(response.status, 401, "diagnostic must reject anonymous, forged and customer-role sessions");
      const body = await response.text();
      assert.doesNotMatch(body, /UPLOADS_DIR|joro-uploads|processUid|configured|[A-Z]:\\|\/home\//);
    }
    results.push({ release: releaseName, newImageHTTP: 200, legacyHTTP: 200, runtimeImageHTTP: 200, privateHTTP: 404,
      anonymousDiagnosticHTTP: 401, forgedDiagnosticHTTP: 401, customerDiagnosticHTTP: 401, checksum: sha(bytes) });
    const exited = once(child, "exit"); child.kill(); await exited; child = undefined;
  }
  console.log(JSON.stringify({ localOnly: true, productionVerified: false, restartAndReleaseSwitchPassed: true, results }, null, 2));
} finally {
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  if (fixture.startsWith(`${cache}${path.sep}public-http-test-`)) await fs.rm(fixture, { recursive: true, force: true });
}
