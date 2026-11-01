// Run: node --import tsx scripts/uploads-migrate.mjs --source <absolute-public-uploads> --target <absolute-external-root> [--apply]
// Defaults to dry run. No database, overwrites, source deletions or Cloudinary calls.
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const { publicUploadPath, publicUploadsRoot, validatePublicImage, copyHistoricalPublicImage, readPublicImage } = createRequire(import.meta.url)("../lib/public-uploads.ts");

const argv = process.argv.slice(2);
const permitted = new Set(["--source", "--target", "--apply"]);
let source, target;
let apply = false;
for (let i = 0; i < argv.length; i++) {
  if (!permitted.has(argv[i])) throw new Error("Unknown argument.");
  if (argv[i] === "--apply") apply = true;
  else if (argv[i] === "--source") source = argv[++i];
  else target = argv[++i];
}
if (!source || !target || !path.isAbsolute(source) || !path.isAbsolute(target)) throw new Error("Explicit absolute --source and --target are required.");
source = await fs.realpath(source);
target = await fs.realpath(target);
const contains = (a, b) => { const rel = path.relative(a, b); return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel)); };
if (contains(source, target) || contains(target, source)) throw new Error("Source and target must be separate directories.");
process.env.UPLOADS_DIR = target;
process.env.NODE_ENV = "production";
await publicUploadsRoot();
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const report = { mode: apply ? "copy-exclusive" : "dry-run", source, target, files: [] };
async function walk(directory, parts = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = [...parts, entry.name].join("/");
    if (entry.isSymbolicLink()) { report.files.push({ path: relative, status: "rejected-symlink" }); continue; }
    if (entry.isDirectory()) {
      if (parts.length < 2 && ["categories", "products", "promotions", "vendor-products", "wants", "reviews"].includes([...parts, entry.name][0])) await walk(path.join(directory, entry.name), [...parts, entry.name]);
      continue;
    }
    if (!entry.isFile() || !publicUploadPath(relative)) continue;
    try {
      const full = path.join(directory, entry.name);
      if ((await fs.stat(full)).size > 8 * 1024 * 1024) throw new Error("oversize");
      const bytes = await fs.readFile(full);
      const ext = path.extname(relative).toLowerCase();
      await validatePublicImage(bytes, ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg");
      const hash = sha(bytes);
      const existing = await readPublicImage(relative, false);
      if (existing) {
        report.files.push({ path: relative, sha256: hash, status: sha(existing.bytes) === hash ? "already-identical" : "conflict-retained-target" });
      } else if (apply) {
        await copyHistoricalPublicImage(relative, bytes);
        const copied = await readPublicImage(relative, false);
        if (!copied || sha(copied.bytes) !== hash) throw new Error("verification");
        report.files.push({ path: relative, sha256: hash, status: "copied-verified" });
      } else report.files.push({ path: relative, sha256: hash, status: "would-copy" });
    } catch {
      report.files.push({ path: relative, status: "rejected-or-copy-failed-original-retained" });
    }
  }
}
await walk(source);
console.log(JSON.stringify(report, null, 2));
if (report.files.some(file => /conflict|rejected|failed/.test(file.status))) process.exitCode = 2;
