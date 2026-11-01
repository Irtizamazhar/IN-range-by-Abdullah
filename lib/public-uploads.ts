import { promises as fs, constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { imageExtension } from "@/lib/security/image-signature";

export const PUBLIC_UPLOAD_REFERENCE_MIME = "application/x-joro-public-upload-reference";
const folders = new Set(["categories", "products", "promotions", "vendor-products", "wants", "reviews", "services"]);
const MAX_BYTES = 8 * 1024 * 1024;

export function publicUploadPath(value: string): string | null {
  const parts = value.split("/");
  if (!folders.has(parts[0]) || parts.length < 2 || parts.length > 3) return null;
  if (parts.some(part => !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,200}$/.test(part) || part.includes(".."))) return null;
  return /\.(?:jpe?g|png|webp)$/i.test(parts.at(-1)!) ? parts.join("/") : null;
}

export function publicUploadUrl(value: string): string | null {
  return value.startsWith("/uploads/") ? publicUploadPath(value.slice(9)) : null;
}

function within(base: string, target: string) {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

/** Production requires an existing external root. Never create or fall back to a release directory. */
export async function publicUploadsRoot(): Promise<string> {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Public image storage is not configured.");
  if (configured && !path.isAbsolute(configured)) throw new Error("Public image storage requires an absolute directory.");
  const requested = path.resolve(configured || path.join(process.cwd(), "public", "uploads"));
  if (!configured) await fs.mkdir(requested, { recursive: true });
  const root = await fs.realpath(requested);
  if (!(await fs.stat(root)).isDirectory()) throw new Error("Invalid public image storage.");
  if (process.env.NODE_ENV === "production") {
    const cwd = await fs.realpath(process.cwd());
    if (within(cwd, root) || within(root, cwd) || /(?:^|[\\/])(?:hbuilds|\.next|public|tmp|temp)(?:[\\/]|$)/i.test(root)) {
      throw new Error("Public image storage must be outside application releases.");
    }
  }
  return root;
}

/** Reject symlinks in every child component. Root itself is resolved/validated above. */
async function safeFile(root: string, relative: string, createParents = false): Promise<string> {
  if (!publicUploadPath(relative)) throw new Error("Invalid public image path.");
  const parts = relative.split("/");
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    if (createParents) await fs.mkdir(current, { mode: 0o755 }).catch(error => { if (error.code !== "EEXIST") throw error; });
    const entry = await fs.lstat(current);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("Unsafe public image directory.");
  }
  const file = path.join(current, parts.at(-1)!);
  const entry = await fs.lstat(file).catch(error => { if (error.code !== "ENOENT") throw error; return null; });
  if (entry && (!entry.isFile() || entry.isSymbolicLink())) throw new Error("Unsafe public image file.");
  return file;
}

export async function validatePublicImage(bytes: Buffer, mime: string): Promise<string> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Invalid public image size.");
  const extension = imageExtension(bytes, mime);
  if (!extension) throw new Error("Invalid public image format.");
  // Decode before persistence, bounding decompression and rejecting malformed images.
  await sharp(bytes, { limitInputPixels: 40_000_000, animated: false }).toBuffer();
  return extension;
}

/** Exclusive publication: originals are never replaced, including by the recovery utility. */
export async function copyHistoricalPublicImage(relative: string, bytes: Buffer): Promise<void> {
  const ext = path.extname(relative).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  await validatePublicImage(bytes, mime);
  const root = await publicUploadsRoot();
  const destination = await safeFile(root, relative, true);
  // Publish a complete file via an exclusive hard link on the same filesystem.
  const temporary = path.join(path.dirname(destination), `.pending-${randomUUID()}`);
  try {
    const handle = await fs.open(temporary, "wx", 0o644);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await fs.link(temporary, destination);
  } finally { await fs.unlink(temporary).catch(() => undefined); }
}

export async function savePublicImage(bytes: Buffer, mime: string, folder: string, prefix = "image") {
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?$/.test(folder) || !folders.has(folder.split("/")[0]) || !/^[A-Za-z0-9_-]+$/.test(prefix)) throw new Error("Invalid image folder.");
  const extension = imageExtension(bytes, mime);
  if (!extension) throw new Error("Invalid public image format.");
  const id = `${prefix}-${Date.now()}-${randomUUID()}.${extension}`;
  const relative = `${folder}/${id}`;
  await copyHistoricalPublicImage(relative, bytes);
  return { id, url: `/uploads/${relative}` };
}

export async function readPublicImage(relative: string, legacyFallback = true): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!publicUploadPath(relative)) return null;
  const root = await publicUploadsRoot();
  const legacy = path.resolve(process.cwd(), "public", "uploads");
  for (const candidate of root === legacy || !legacyFallback ? [root] : [root, legacy]) {
    try {
      const file = await safeFile(candidate, relative);
      const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_BYTES) return null;
        const bytes = await handle.readFile();
        const ext = path.extname(relative).toLowerCase();
        const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        return imageExtension(bytes, mime) ? { bytes, mime } : null;
      } finally { await handle.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

/** Run inside the deployed application: tests this Node process's filesystem permissions, without writes. */
export async function inspectPublicStorage() {
  const root = await publicUploadsRoot();
  await fs.access(root, constants.R_OK | constants.W_OK | constants.X_OK);
  return { configured: Boolean(process.env.UPLOADS_DIR?.trim()), accessibleToNodeProcess: true,
    externalToRelease: !within(await fs.realpath(process.cwd()), root),
    processUid: process.getuid?.() ?? null, persistenceVerified: false };
}
