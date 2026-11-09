// Private-document storage migration and audit (vendor CNIC/licence documents, support attachments,
// vendor appeal evidence). See docs/PRIVATE_STORAGE_AND_VERIFICATION.md.
//
//   node scripts/private-storage.mjs copy --source <abs dir> --target <abs dir> [--apply]
//     Copies <namespace>/<owner>/<file> from an old storage/private folder (current release, a previous
//     release or a restored backup) into PRIVATE_STORAGE_DIR. Dry run unless --apply. Never overwrites,
//     never deletes the source, skips symlinks/unknown paths, verifies SHA-256 after each copy.
//
//   node scripts/private-storage.mjs audit --root <abs dir> [--legacy <abs dir>]
//     READ-ONLY database query (DATABASE_URL from the environment) listing document records whose
//     file exists in neither directory. Prints ids, types and seller status only, never file contents.
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const NAMESPACES = ["vendor-docs", "support", "vendor-appeals"];
const SEGMENT = /^[A-Za-z0-9_-]+$/;
const FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const MAX_BYTES = 8 * 1024 * 1024;

function args(allowed) {
  const argv = process.argv.slice(3);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!allowed.includes(key)) throw new Error(`Unknown argument: ${key}`);
    if (key === "--apply") out.apply = true;
    else out[key.slice(2)] = argv[++i];
  }
  return out;
}

function absolute(value, name) {
  if (!value || !path.isAbsolute(value)) throw new Error(`--${name} must be an absolute path.`);
  return path.resolve(value);
}

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const contains = (parent, child) => { const rel = path.relative(parent, child); return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)); };

async function copy() {
  const options = args(["--source", "--target", "--apply"]);
  const source = await fs.realpath(absolute(options.source, "source"));
  const target = absolute(options.target, "target");
  await fs.mkdir(target, { recursive: true, mode: 0o700 });
  const realTarget = await fs.realpath(target);
  if (contains(source, realTarget) || contains(realTarget, source)) throw new Error("Source and target must be separate directories.");
  const report = { mode: options.apply ? "copy-exclusive" : "dry-run", copied: 0, wouldCopy: 0, alreadyPresent: 0, conflicts: 0, skipped: 0, errors: 0, items: [] };
  for (const namespace of NAMESPACES) {
    const nsDir = path.join(source, namespace);
    let owners = [];
    try { owners = await fs.readdir(nsDir, { withFileTypes: true }); } catch { continue; }
    for (const owner of owners) {
      if (!owner.isDirectory() || owner.isSymbolicLink() || !SEGMENT.test(owner.name)) { report.skipped++; continue; }
      for (const file of await fs.readdir(path.join(nsDir, owner.name), { withFileTypes: true })) {
        const relative = `${namespace}/${owner.name}/${file.name}`;
        if (!file.isFile() || file.isSymbolicLink() || !FILE.test(file.name) || file.name.includes("..")) { report.skipped++; report.items.push({ path: relative, status: "skipped" }); continue; }
        try {
          const from = path.join(nsDir, owner.name, file.name);
          const to = path.join(realTarget, namespace, owner.name, file.name);
          const bytes = await fs.readFile(from);
          if (bytes.length > MAX_BYTES) { report.skipped++; report.items.push({ path: relative, status: "skipped-oversize" }); continue; }
          let existing = null;
          try { existing = await fs.readFile(to); } catch { /* not present */ }
          if (existing) {
            const same = sha(existing) === sha(bytes);
            report[same ? "alreadyPresent" : "conflicts"]++;
            report.items.push({ path: relative, status: same ? "already-present" : "conflict-different-content-kept-target" });
            continue;
          }
          if (!options.apply) { report.wouldCopy++; report.items.push({ path: relative, status: "would-copy" }); continue; }
          await fs.mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
          await fs.copyFile(from, to, constants.COPYFILE_EXCL);
          await fs.chmod(to, 0o600).catch(() => {});
          if (sha(await fs.readFile(to)) !== sha(bytes)) throw new Error("checksum mismatch after copy");
          report.copied++;
          report.items.push({ path: relative, status: "copied" });
        } catch (error) {
          report.errors++;
          report.items.push({ path: relative, status: `error: ${error instanceof Error ? error.message : "unknown"}` });
        }
      }
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.errors) process.exitCode = 1;
}

async function exists(roots, relative) {
  for (const root of roots) {
    try { await fs.access(path.join(root, ...relative.split("/"))); return true; } catch { /* next */ }
  }
  return false;
}

async function audit() {
  const options = args(["--root", "--legacy"]);
  const roots = [absolute(options.root, "root"), ...(options.legacy ? [absolute(options.legacy, "legacy")] : [])];
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set in the environment (read-only queries only).");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const documents = await prisma.vendorDocument.findMany({ select: { id: true, vendorId: true, documentType: true, fileUrl: true, uploadedAt: true, vendor: { select: { status: true } } } });
    const attachments = await prisma.supportMessage.findMany({ where: { attachmentUrl: { not: null } }, select: { id: true, ticketId: true, attachmentUrl: true } });
    const missingDocuments = [];
    for (const doc of documents) {
      const relative = doc.fileUrl.replace(/\\/g, "/").replace(/^\/uploads\//, "");
      if (!await exists(roots, relative)) missingDocuments.push({ documentId: doc.id, vendorId: doc.vendorId, documentType: doc.documentType, vendorStatus: doc.vendor.status, uploadedAt: doc.uploadedAt.toISOString() });
    }
    const missingAttachments = [];
    for (const message of attachments) {
      if (!await exists(roots, String(message.attachmentUrl))) missingAttachments.push({ messageId: message.id, ticketId: message.ticketId });
    }
    const affectedVendors = [...new Set(missingDocuments.map(item => item.vendorId))];
    console.log(JSON.stringify({ checkedDocuments: documents.length, missingDocuments: missingDocuments.length, affectedVendors: affectedVendors.length, checkedAttachments: attachments.length, missingAttachments: missingAttachments.length, missingDocumentList: missingDocuments, missingAttachmentList: missingAttachments }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const command = process.argv[2];
if (command === "copy") await copy();
else if (command === "audit") await audit();
else {
  console.error("Usage: node scripts/private-storage.mjs copy --source <abs> --target <abs> [--apply] | audit --root <abs> [--legacy <abs>]");
  process.exitCode = 2;
}
