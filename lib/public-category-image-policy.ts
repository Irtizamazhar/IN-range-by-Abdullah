import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

/** Only flat public category raster files; never API URLs, external origins or documents. */
export function isOptimizablePublicCategoryImage(src: string): boolean {
  const prefix = "/uploads/categories/";
  if (!src.startsWith(prefix)) return false;
  const filename = src.slice(prefix.length);
  return /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,200}$/.test(filename)
    && !filename.includes("..") && /\.(?:jpe?g|png|webp)$/i.test(filename);
}

export function shouldUnoptimizeCategoryImage(src: string): boolean {
  return isOptimizablePublicCategoryImage(src) ? false : shouldUnoptimizeImageSrc(src);
}
