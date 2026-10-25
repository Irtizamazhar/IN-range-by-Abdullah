import { promises as fs } from "fs";
import path from "path";
import { ApiError } from "@/lib/marketplace-api";

/** One plain file name inside `public/uploads/wants/` — no sub-folders, traversal or query strings. */
export const WANT_PHOTO_PATTERN = /^\/uploads\/wants\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,180}\.(?:jpe?g|png|webp)$/i;

function wantPhotoPath(url: string) {
  return path.join(process.cwd(), "public", "uploads", "wants", url.slice("/uploads/wants/".length));
}

/** Best-effort removal of a customer Want photo stored under `public/uploads/wants/`. */
export async function removeWantPhotoFile(url: string | null | undefined) {
  const name = url?.startsWith("/uploads/wants/") ? url.slice("/uploads/wants/".length) : "";
  if (!/^[\w.-]+$/.test(name)) return;
  await fs.unlink(path.join(process.cwd(), "public", "uploads", "wants", name)).catch(() => undefined);
}

/** The photo list to save from validated input: `photos` when sent, else the single legacy `photo`. Deduplicated. */
export function wantPhotoList(input: { photo?: string | null; photos?: string[] }) {
  const list = input.photos ?? (input.photo ? [input.photo] : []);
  return Array.from(new Set(list));
}

/**
 * Each Want image (`Want.photos`, first mirrored in `Want.photo`) must be checked here. The upload endpoint only accepts customer sessions and
 * verifies image bytes; here we make sure the saved reference points at a real uploaded Want photo.
 */
export async function assertWantPhotoStored(url: string | null | undefined) {
  if (!url) return;
  if (!WANT_PHOTO_PATTERN.test(url)) throw new ApiError(400, "Invalid photo.");
  const stat = await fs.stat(wantPhotoPath(url)).catch(() => null);
  if (!stat?.isFile()) throw new ApiError(400, "This photo upload has expired. Please choose the image again.");
}
