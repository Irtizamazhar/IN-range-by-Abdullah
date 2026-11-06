import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

/** Client-safe exception for public product images only; no filesystem or credentials. */
export function isOptimizablePublicProductImage(src: string): boolean {
  if (!/^\/uploads\/(?:products|vendor-products)\//.test(src)) return false;
  const parts = src.slice("/uploads/".length).split("/");
  if (parts.length < 2 || parts.length > 3) return false;
  if (parts.some(part => !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,200}$/.test(part) || part.includes(".."))) return false;
  return /\.(?:jpe?g|png|webp)$/i.test(parts.at(-1)!);
}

export function shouldUnoptimizeProductImage(src: string): boolean {
  return isOptimizablePublicProductImage(src) ? false : shouldUnoptimizeImageSrc(src);
}
