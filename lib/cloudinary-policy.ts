/** Shared URL checks only: this module must never import server credentials. */
export const CLOUDINARY_REFERENCE_MIME = "application/x-joro-cloudinary-reference";

export function cloudinaryImageReference(value: string): { cloud: string; publicId: string } | null {
  // No transformations, query strings, encoded paths, credentials, or alternative hosts.
  const match = /^https:\/\/res\.cloudinary\.com\/([A-Za-z0-9_-]+)\/image\/upload\/v[0-9]+\/(joro\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+)\.(?:jpg|jpeg|png|webp)$/.exec(value);
  return match ? { cloud: match[1], publicId: match[2] } : null;
}

export function isCloudinaryPhoto(value: string, kind: "wants" | "reviews", owner?: string): boolean {
  const ref = cloudinaryImageReference(value);
  if (!ref) return false;
  const parts = ref.publicId.split("/");
  return parts.length === 4 && parts[1] === kind && (!owner || parts[2] === owner);
}

export function isWantPhotoUrl(value: string): boolean {
  const legacy = /^\/uploads\/wants\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,180}\.(?:jpe?g|png|webp)$/i.test(value);
  const owned = /^\/uploads\/wants\/[A-Za-z0-9_-]+\/want-[0-9]+-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|png|webp)$/i.test(value);
  return legacy || owned || isCloudinaryPhoto(value, "wants");
}
