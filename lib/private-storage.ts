import { constants, promises as fs } from "node:fs";
import path from "node:path";

/**
 * Private (never public) file storage for vendor identity documents, support attachments and vendor
 * appeal evidence.
 *
 * New files go to PRIVATE_STORAGE_DIR, an absolute directory OUTSIDE the deployed release (Hostinger
 * replaces the release directory on every deployment, which deleted files kept under
 * `process.cwd()/storage/private`). Reads try the persistent root first and then the legacy
 * in-release root, so records whose files still exist there keep working until they are copied
 * (scripts/private-storage.mjs).
 *
 * Stored relative paths keep their existing format (`vendor-docs/<vendorId>/<file>`,
 * `support/<ticketId>/<file>`, `vendor-appeals/<vendorId>/<file>`), so no database rows change.
 */
export const PRIVATE_NAMESPACES = ["vendor-docs", "support", "vendor-appeals"] as const;
export type PrivateNamespace = (typeof PRIVATE_NAMESPACES)[number];

const SEGMENT = /^[A-Za-z0-9_-]+$/;
const FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

export class PrivateStorageConfigError extends Error {}

export function legacyPrivateRoot(): string {
  return path.resolve(process.cwd(), "storage", "private");
}

/** Throws when PRIVATE_STORAGE_DIR is set to something unsafe; falls back to the legacy root when unset. */
export function privateStorageRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PRIVATE_STORAGE_DIR?.trim();
  if (!configured) return legacyPrivateRoot();
  if (!path.isAbsolute(configured)) throw new PrivateStorageConfigError("PRIVATE_STORAGE_DIR must be an absolute path.");
  const root = path.resolve(configured);
  const inside = (parent: string) => root === parent || root.startsWith(`${parent}${path.sep}`);
  const publicDir = path.resolve(process.cwd(), "public");
  if (inside(publicDir)) throw new PrivateStorageConfigError("PRIVATE_STORAGE_DIR must not be inside the public directory.");
  const uploads = env.UPLOADS_DIR?.trim();
  if (uploads && path.isAbsolute(uploads)) {
    const uploadsRoot = path.resolve(uploads);
    if (inside(uploadsRoot) || uploadsRoot.startsWith(`${root}${path.sep}`)) {
      throw new PrivateStorageConfigError("PRIVATE_STORAGE_DIR must be separate from the public UPLOADS_DIR.");
    }
  }
  return root;
}

export function privateStorageConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.PRIVATE_STORAGE_DIR?.trim());
}

/**
 * Validates a stored relative path ("vendor-docs/<id>/<file>"). Accepts the historical
 * "/uploads/vendor-docs/..." form. Returns null for anything that is not exactly three safe parts.
 */
export function normalizePrivatePath(stored: string): string | null {
  let value = String(stored || "").replace(/\\/g, "/");
  if (value.startsWith("/uploads/vendor-docs/")) value = value.slice("/uploads/".length);
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [namespace, owner, file] = parts;
  if (!(PRIVATE_NAMESPACES as readonly string[]).includes(namespace)) return null;
  if (!SEGMENT.test(owner) || !FILE.test(file) || file.includes("..")) return null;
  return `${namespace}/${owner}/${file}`;
}

export function privatePath(namespace: PrivateNamespace, owner: string, fileName: string): string {
  const relative = normalizePrivatePath(`${namespace}/${owner}/${fileName}`);
  if (!relative) throw new Error("Invalid private file path.");
  return relative;
}

function resolveWithin(root: string, relative: string): string | null {
  const resolved = path.resolve(root, ...relative.split("/"));
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

function readRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  const roots = [privateStorageRoot(env), legacyPrivateRoot()];
  return roots.filter((root, index) => roots.indexOf(root) === index);
}

/** Writes a new private file (owner-only permissions). Never overwrites an existing file. */
export async function writePrivateFile(relativePath: string, data: Buffer): Promise<string> {
  const relative = normalizePrivatePath(relativePath);
  if (!relative) throw new Error("Invalid private file path.");
  const full = resolveWithin(privateStorageRoot(), relative);
  if (!full) throw new Error("Invalid private file path.");
  await fs.mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
  await fs.writeFile(full, data, { flag: "wx", mode: 0o600 });
  return relative;
}

/** Reads a private file from persistent storage, then the legacy in-release folder. Null when missing. */
export async function readPrivateFile(storedPath: string): Promise<Buffer | null> {
  const relative = normalizePrivatePath(storedPath);
  if (!relative) return null;
  for (const root of readRoots()) {
    const full = resolveWithin(root, relative);
    if (!full) continue;
    try {
      return await fs.readFile(full);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

export async function privateFileExists(storedPath: string): Promise<boolean> {
  const relative = normalizePrivatePath(storedPath);
  if (!relative) return false;
  for (const root of readRoots()) {
    const full = resolveWithin(root, relative);
    if (!full) continue;
    try { await fs.access(full); return true; } catch { /* try next root */ }
  }
  return false;
}

export function privateImageMime(storedPath: string): string {
  const extension = path.extname(storedPath).toLowerCase();
  return extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
}

/** Admin storage check: creates the root if missing (owner-only), then confirms read/write access. Never returns paths. */
export async function privateStorageDiagnostics(): Promise<{ configured: boolean; usable: boolean; legacyFallback: boolean; error?: string }> {
  try {
    const root = privateStorageRoot();
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    await fs.access(root, constants.R_OK | constants.W_OK);
    return { configured: privateStorageConfigured(), usable: true, legacyFallback: root !== legacyPrivateRoot() };
  } catch (error) {
    return { configured: privateStorageConfigured(), usable: false, legacyFallback: true, error: error instanceof PrivateStorageConfigError ? error.message : "Private storage is not accessible to the application." };
  }
}
