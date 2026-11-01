import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { publicUploadPath, publicUploadsRoot, savePublicImage, readPublicImage, copyHistoricalPublicImage, inspectPublicStorage } from "../lib/public-uploads";
import { GET } from "../app/api/uploads/[...path]/route";
import { assertWantPhotoStored, removeWantPhotoFile } from "../lib/want-photo-file";
import { wantInput } from "../lib/want-schema";
import { reviewPhotoUrlForCustomer, isPublicReviewPhotoUrl } from "../lib/review-policy";

test("persistent public storage and compatibility", async t => {
  const project = process.cwd();
  const cache = path.join(project, "node_modules", ".cache");
  await fs.mkdir(cache, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(cache, "public-upload-test-"));
  const root = path.join(fixture, "durable");
  const release = path.join(fixture, "release");
  await fs.mkdir(root); await fs.mkdir(release);
  const previous = { UPLOADS_DIR: process.env.UPLOADS_DIR, NODE_ENV: process.env.NODE_ENV };
  process.env.UPLOADS_DIR = root;
  Object.assign(process.env, { NODE_ENV: "development" });
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#047857" } }).png().toBuffer();
  const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  try {
    await t.test("all six public namespaces upload, serve HTTP 200 immediately and retain checksum", async () => {
      for (const folder of ["categories", "products", "promotions", "vendor-products/vendor-a", "wants/customer-a", "reviews/customer-a"]) {
        const saved = await savePublicImage(bytes, "image/png", folder, folder.startsWith("reviews") ? "rev" : "want");
        const relative = saved.url.slice(9);
        assert.equal(hash(await fs.readFile(path.join(root, relative))), hash(bytes));
        const response = await GET(new Request(`https://joro.pk${saved.url}`), { params: { path: relative.split("/") } });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "image/png");
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(bytes));
      }
    });
    await t.test("replacement uses a new filename; removal retains original files", async () => {
      const a = await savePublicImage(bytes, "image/png", "wants/customer-a", "want");
      const b = await savePublicImage(bytes, "image/png", "wants/customer-a", "want");
      assert.notEqual(a.url, b.url);
      await assertWantPhotoStored(a.url, "customer-a");
      await assert.rejects(assertWantPhotoStored(a.url, "customer-b"), /owner/);
      await removeWantPhotoFile(a.url);
      assert.ok(await readPublicImage(a.url.slice(9)));
      assert.ok(await readPublicImage(b.url.slice(9)));
      const input = { title: "Test Want", category: "Electronics", city: "Lahore", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null, photos: [a.url] };
      assert.ok(wantInput.safeParse(input).success);
      const review = await savePublicImage(bytes, "image/png", "reviews/customer-a", "rev");
      assert.ok(reviewPhotoUrlForCustomer(review.url, "customer-a"));
      assert.ok(isPublicReviewPhotoUrl(review.url));
      assert.equal(reviewPhotoUrlForCustomer(review.url, "customer-b"), false);
    });
    await t.test("legacy flat URLs fall back to available originals and persistent files take precedence", async () => {
      process.chdir(release);
      const legacy = path.join(release, "public", "uploads", "wants");
      await fs.mkdir(legacy, { recursive: true });
      await fs.writeFile(path.join(legacy, "want-old.png"), bytes);
      assert.equal(hash((await readPublicImage("wants/want-old.png"))!.bytes), hash(bytes));
      await copyHistoricalPublicImage("wants/want-old.png", bytes);
      await assert.rejects(copyHistoricalPublicImage("wants/want-old.png", bytes), { code: "EEXIST" });
      await fs.writeFile(path.join(legacy, "want-old.png"), "unusable-old-copy");
      assert.equal(hash((await readPublicImage("wants/want-old.png"))!.bytes), hash(bytes));
      await assertWantPhotoStored("/uploads/wants/want-old.png", "customer-a");
      process.chdir(project);
    });
    await t.test("private paths, traversal, executables, oversized and malformed images are rejected", async () => {
      for (const relative of ["vendor-docs/x/a.png", "vendor-appeals/x/a.png", "support/x/a.png", "categories/../a.png", "categories/%2e%2e/a.png", "categories/a.svg", "categories/a.php", "categories/a.png?x", "categories/a\\b.png"]) {
        assert.equal(publicUploadPath(relative), null);
        assert.equal((await GET(new Request("https://joro.pk/uploads/test"), { params: { path: relative.split("/") } })).status, 404);
      }
      await assert.rejects(savePublicImage(Buffer.alloc(9 * 1024 * 1024), "image/png", "categories"));
      await assert.rejects(savePublicImage(Buffer.from("<svg/>"), "image/png", "categories"));
      await assert.rejects(savePublicImage(bytes.subarray(0, 8), "image/png", "categories"));
      assert.equal((await GET(new Request("https://joro.pk/uploads/missing"), { params: { path: ["categories", "missing.png"] } })).status, 404);
    });
    await t.test("production fails closed for missing or release-managed roots", async () => {
      Object.assign(process.env, { NODE_ENV: "production" });
      delete process.env.UPLOADS_DIR;
      await assert.rejects(publicUploadsRoot(), /not configured/);
      process.env.UPLOADS_DIR = "relative/uploads";
      await assert.rejects(publicUploadsRoot(), /absolute/);
      process.env.UPLOADS_DIR = root;
      await assert.rejects(publicUploadsRoot(), /outside/);
      process.chdir(release);
      const status = await inspectPublicStorage();
      assert.equal(status.accessibleToNodeProcess, true);
      assert.equal(status.externalToRelease, true);
      assert.equal(status.persistenceVerified, false);
      process.chdir(project);
      Object.assign(process.env, { NODE_ENV: "development" });
    });
    await t.test("symlinked child directories cannot serve or receive uploads", async () => {
      const outside = path.join(fixture, "private-files"); await fs.mkdir(outside);
      await fs.writeFile(path.join(outside, "secret.png"), bytes);
      await fs.symlink(outside, path.join(root, "products", "escape"), process.platform === "win32" ? "junction" : "dir");
      await assert.rejects(readPublicImage("products/escape/secret.png"), /Unsafe/);
      await assert.rejects(savePublicImage(bytes, "image/png", "products/escape"), /Unsafe/);
    });
    await t.test("new release directories read the same persistent file and checksum", async () => {
      const saved = await savePublicImage(bytes, "image/png", "categories");
      for (const name of ["release-one", "release-two"]) {
        const dir = path.join(fixture, name); await fs.mkdir(dir); process.chdir(dir);
        assert.equal(hash((await readPublicImage(saved.url.slice(9)))!.bytes), hash(bytes));
      }
      process.chdir(project);
    });
    await t.test("migration dry-run writes nothing; apply copies exclusively and retains conflicts and sources", async () => {
      const source = path.join(fixture, "source"); await fs.mkdir(path.join(source, "categories"), { recursive: true });
      await fs.writeFile(path.join(source, "categories", "recover.png"), bytes);
      const run = (apply: boolean, expected = 0) => {
        const result = spawnSync(process.execPath, ["--require", path.join(project, "scripts", "test-userinfo-fallback.cjs"), "--import", pathToFileURL(path.join(project, "node_modules", "tsx", "dist", "loader.mjs")).href,
          path.join(project, "scripts", "uploads-migrate.mjs"), "--source", source, "--target", root, ...(apply ? ["--apply"] : [])],
        { cwd: release, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(project, "tsconfig.json") }, encoding: "utf8" });
        assert.equal(result.status, expected, result.stderr);
        return JSON.parse(result.stdout);
      };
      assert.equal(run(false).files[0].status, "would-copy");
      assert.equal(await readPublicImage("categories/recover.png", false), null);
      assert.equal(run(true).files[0].status, "copied-verified");
      assert.equal(run(true).files[0].status, "already-identical");
      assert.equal(hash(await fs.readFile(path.join(source, "categories", "recover.png"))), hash(bytes));
      const different = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
      await fs.writeFile(path.join(source, "categories", "recover.png"), different);
      assert.equal(run(true, 2).files[0].status, "conflict-retained-target");
      assert.equal(hash((await readPublicImage("categories/recover.png", false))!.bytes), hash(bytes));
      assert.equal(hash(await fs.readFile(path.join(source, "categories", "recover.png"))), hash(different));
    });
  } finally {
    process.chdir(project);
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (fixture.startsWith(`${cache}${path.sep}public-upload-test-`)) await fs.rm(fixture, { recursive: true, force: true });
  }
});
