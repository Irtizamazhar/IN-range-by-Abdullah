/** Paths and schemes the Next.js optimizer cannot fetch (same rules as storefront product images). */
export function shouldUnoptimizeImageSrc(src: string): boolean {
  return (
    src.startsWith("/api/") ||
    src.startsWith("/uploads/") ||
    src.startsWith("blob:") ||
    src.startsWith("data:")
  );
}
