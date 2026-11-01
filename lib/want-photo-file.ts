import { assertCloudinaryImageStored } from "@/lib/cloudinary";
import { isCloudinaryPhoto } from "@/lib/cloudinary-policy";
import { readPublicImage } from "@/lib/public-uploads";
import { isWantPhotoUrl } from "@/lib/cloudinary-policy";
import { ApiError } from "@/lib/marketplace-api";

/** One plain file name inside `public/uploads/wants/` — no sub-folders, traversal or query strings. */
export const WANT_PHOTO_PATTERN = /^\/uploads\/wants\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,180}\.(?:jpe?g|png|webp)$/i;

/** Logical removal only. Preserve existing files and assets until an approved orphan cleanup. */
export async function removeWantPhotoFile(url: string | null | undefined) {
  // Retain physical assets. Orphan cleanup requires a separate audited approval.
  void url;
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
export async function assertWantPhotoStored(url: string | null | undefined, customerId?: string) {
  if (!url) return;
  if (isCloudinaryPhoto(url, "wants", customerId)) {
    if (!customerId) throw new ApiError(400, "Invalid photo owner.");
    try { await assertCloudinaryImageStored(url, `joro/wants/${customerId}`); }
    catch { throw new ApiError(400, "Photo could not be verified. Please upload it again."); }
    return;
  }
  if (!isWantPhotoUrl(url)) throw new ApiError(400, "Invalid photo.");
  const parts = url.slice("/uploads/".length).split("/");
  if (parts.length === 3 && parts[1] !== customerId) throw new ApiError(400, "Invalid photo owner.");
  const image = await readPublicImage(parts.join("/")).catch(() => null);
  if (!image) throw new ApiError(400, "This photo upload has expired. Please choose the image again.");
}
