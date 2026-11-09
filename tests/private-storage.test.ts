import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
// Reads cwd/env at call time, so the sandbox below applies even though imports are hoisted.
import * as storage from "../lib/private-storage";

const repo = process.cwd();
// Each test file runs in its own process: point the legacy root (cwd/storage/private) at a sandbox.
const sandbox = mkdtempSync(path.join(tmpdir(), "joro-private-"));
const persistent = path.join(sandbox, "joro-private");
const release = path.join(sandbox, "release");
mkdirSync(release, { recursive: true });
process.chdir(release);
process.env.PRIVATE_STORAGE_DIR = persistent;
process.env.UPLOADS_DIR = path.join(sandbox, "joro-uploads");


test.after(() => { process.chdir(repo); rmSync(sandbox, { recursive: true, force: true }); });

test("only exact <namespace>/<owner>/<file> paths are accepted; traversal is rejected", () => {
  assert.equal(storage.normalizePrivatePath("vendor-docs/v1/cnic_front-1.jpg"), "vendor-docs/v1/cnic_front-1.jpg");
  assert.equal(storage.normalizePrivatePath("/uploads/vendor-docs/v1/a.png"), "vendor-docs/v1/a.png");
  assert.equal(storage.normalizePrivatePath("support\\t1\\m1.webp"), "support/t1/m1.webp");
  for (const bad of ["../etc/passwd", "vendor-docs/../../x", "vendor-docs/v1/..", "vendor-docs/v1/../a.jpg", "products/v1/a.jpg", "vendor-docs/v1", "vendor-docs/v 1/a.jpg", "vendor-docs/v1/a/b.jpg", "/etc/passwd", ""]) {
    assert.equal(storage.normalizePrivatePath(bad), null, bad);
  }
});

test("new files go to PRIVATE_STORAGE_DIR, never overwrite, and old in-release files are still readable", async () => {
  const relative = await storage.writePrivateFile("vendor-docs/vendor-1/cnic_front-1.jpg", Buffer.from("front"));
  assert.ok(existsSync(path.join(persistent, "vendor-docs", "vendor-1", "cnic_front-1.jpg")));
  assert.ok(!existsSync(path.join(release, "storage", "private", "vendor-docs", "vendor-1", "cnic_front-1.jpg")));
  await assert.rejects(storage.writePrivateFile(relative, Buffer.from("other")), /EEXIST/);
  assert.equal((await storage.readPrivateFile(relative))?.toString(), "front");

  // A record written before this release (file inside the release folder) keeps working.
  mkdirSync(path.join(release, "storage", "private", "vendor-docs", "old-vendor"), { recursive: true });
  writeFileSync(path.join(release, "storage", "private", "vendor-docs", "old-vendor", "cnic_back-1.png"), "legacy");
  assert.equal((await storage.readPrivateFile("vendor-docs/old-vendor/cnic_back-1.png"))?.toString(), "legacy");
  assert.equal(await storage.privateFileExists("vendor-docs/old-vendor/cnic_back-1.png"), true);
  assert.equal(await storage.readPrivateFile("vendor-docs/old-vendor/missing.png"), null);
  assert.equal(await storage.readPrivateFile("vendor-docs/../../secret"), null);
});

test("PRIVATE_STORAGE_DIR must be absolute and separate from public uploads", () => {
  assert.throws(() => storage.privateStorageRoot({ PRIVATE_STORAGE_DIR: "joro-private" } as unknown as NodeJS.ProcessEnv), /absolute/);
  assert.throws(() => storage.privateStorageRoot({ PRIVATE_STORAGE_DIR: path.join(release, "public", "private") } as unknown as NodeJS.ProcessEnv), /public/);
  const uploads = path.join(sandbox, "uploads");
  assert.throws(() => storage.privateStorageRoot({ PRIVATE_STORAGE_DIR: path.join(uploads, "private"), UPLOADS_DIR: uploads } as unknown as NodeJS.ProcessEnv), /UPLOADS_DIR/);
  assert.throws(() => storage.privateStorageRoot({ PRIVATE_STORAGE_DIR: sandbox, UPLOADS_DIR: uploads } as unknown as NodeJS.ProcessEnv), /UPLOADS_DIR/);
  assert.equal(storage.privateStorageRoot({} as unknown as NodeJS.ProcessEnv), path.resolve(release, "storage", "private"), "unset falls back to legacy root");
});

test("diagnostics report a usable configured root without exposing paths", async () => {
  const result = await storage.privateStorageDiagnostics();
  assert.deepEqual(result, { configured: true, usable: true, legacyFallback: true });
  assert.ok(!JSON.stringify(result).includes(sandbox));
});

function documentRoute(session: { admin?: boolean; adminAllowed?: boolean; vendorId?: string | null }, document: { vendorId: string; fileUrl: string } | null) {
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/sessions": { getAdminSession: async () => (session.admin ? { user: { role: "admin" } } : null) },
    "@/lib/admin-rbac": { requireAdminPermission: async () => (session.adminAllowed ? { admin: { id: "a" } } : { response: NextResponse.json({}, { status: 403 }) }) },
    "@/lib/vendor-auth-server": { getVendorFromSession: async () => (session.vendorId ? { vendor: { id: session.vendorId } } : null) },
    "@/lib/prisma": { prisma: { vendorDocument: { findUnique: async () => document } } },
    "@/lib/private-storage": storage,
  };
  const source = readFileSync(path.join(repo, "app/api/private/vendor-documents/[id]/route.ts"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { GET?: (request: Request, ctx: { params: { id: string } }) => Promise<Response> } = {};
  runInNewContext(output, { exports: exported, Uint8Array, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } });
  return () => exported.GET!(new Request("https://joro.pk/api/private/vendor-documents/d1"), { params: { id: "d1" } });
}

test("document API: owner and authorised admin can read; others get 404; missing files are reported clearly", async () => {
  const doc = { vendorId: "vendor-1", fileUrl: "vendor-docs/vendor-1/cnic_front-1.jpg" };
  const owner = await documentRoute({ vendorId: "vendor-1" }, doc)();
  assert.equal(owner.status, 200);
  assert.equal(owner.headers.get("cache-control"), "private, no-store");
  assert.equal(Buffer.from(await owner.arrayBuffer()).toString(), "front");
  assert.equal((await documentRoute({ admin: true, adminAllowed: true }, doc)()).status, 200);
  assert.equal((await documentRoute({ admin: true, adminAllowed: false }, doc)()).status, 404, "admin without vendors.manage");
  assert.equal((await documentRoute({ vendorId: "vendor-2" }, doc)()).status, 404, "another seller");
  assert.equal((await documentRoute({}, doc)()).status, 404, "anonymous");
  assert.equal((await documentRoute({ vendorId: "vendor-1" }, null)()).status, 404);
  const missing = await documentRoute({ vendorId: "vendor-1" }, { vendorId: "vendor-1", fileUrl: "vendor-docs/vendor-1/gone.jpg" })();
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, "file_missing");
  assert.equal((await documentRoute({ vendorId: "vendor-1" }, { vendorId: "vendor-1", fileUrl: "../../etc/passwd" })()).status, 500);
});

test("migration script: dry run changes nothing; apply copies exclusively and keeps the source", () => {
  const source = path.join(sandbox, "old-release-storage");
  const target = path.join(sandbox, "migrated");
  mkdirSync(path.join(source, "vendor-docs", "v9"), { recursive: true });
  mkdirSync(path.join(source, "support", "t9"), { recursive: true });
  mkdirSync(path.join(source, "vendor-docs", "v9", "nested"), { recursive: true });
  writeFileSync(path.join(source, "vendor-docs", "v9", "cnic_front-1.jpg"), "A");
  writeFileSync(path.join(source, "support", "t9", "m1.png"), "B");
  writeFileSync(path.join(source, "unrelated.txt"), "C");
  const run = (...args: string[]) => JSON.parse(execFileSync(process.execPath, [path.join(repo, "scripts/private-storage.mjs"), "copy", "--source", source, "--target", target, ...args], { encoding: "utf8" }));
  const dry = run();
  assert.deepEqual([dry.mode, dry.wouldCopy, dry.copied], ["dry-run", 2, 0]);
  assert.equal(existsSync(path.join(target, "vendor-docs")), false);
  const applied = run("--apply");
  assert.deepEqual([applied.copied, applied.errors], [2, 0]);
  assert.equal(readFileSync(path.join(target, "vendor-docs", "v9", "cnic_front-1.jpg"), "utf8"), "A");
  assert.ok(existsSync(path.join(source, "vendor-docs", "v9", "cnic_front-1.jpg")), "source kept");
  writeFileSync(path.join(target, "support", "t9", "m1.png"), "CHANGED");
  const again = run("--apply");
  assert.deepEqual([again.copied, again.alreadyPresent, again.conflicts], [0, 1, 1]);
  assert.equal(readFileSync(path.join(target, "support", "t9", "m1.png"), "utf8"), "CHANGED", "never overwrites");
});
