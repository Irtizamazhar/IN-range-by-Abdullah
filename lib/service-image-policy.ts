/** Shared client/server policy; no credentials or filesystem access. */
export const SERVICE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function serviceImagePath(value: string): { owner: string; relative: string } | null {
  const match = /^\/uploads\/services\/(catalog|vendor-[A-Za-z0-9_-]{1,100})\/(svc-[0-9]+-[a-f0-9-]{36}\.(?:jpg|png|webp))$/.exec(value);
  return match ? { owner: match[1], relative: `services/${match[1]}/${match[2]}` } : null;
}

export function isServiceImageUrl(value: string): boolean {
  if (serviceImagePath(value)) return true;
  return /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/[A-Za-z0-9_./,-]+\.(?:jpe?g|png|webp)$/.test(value) && !value.includes("..");
}

export function serviceImageCandidates(imageUrl?: string | null, defaultImageUrl?: string | null): string[] {
  return Array.from(new Set([imageUrl, defaultImageUrl].filter((value): value is string => Boolean(value && isServiceImageUrl(value)))));
}
