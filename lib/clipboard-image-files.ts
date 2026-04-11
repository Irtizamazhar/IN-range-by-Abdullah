import type { ClipboardEvent } from "react";

/** MIME types accepted for admin product images (paste + file picker). */
export const ADMIN_PRODUCT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isAllowedImageFile(file: File): boolean {
  const t = file.type.toLowerCase();
  return (
    ADMIN_PRODUCT_IMAGE_TYPES.has(t) ||
    t === "image/pjpeg" ||
    t === "image/x-png"
  );
}

/** Build a File[] from a paste event (Ctrl+V / ⌘+V). Caller should call `e.preventDefault()` when handling these files. */
export function imageFilesFromClipboard(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const dt = e.clipboardData;
  if (!dt) return out;

  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      if (f.type.startsWith("image/")) out.push(f);
    }
  }
  if (out.length) return dedupeFiles(out);

  const items = dt.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind !== "file") continue;
      const f = items[i].getAsFile();
      if (f?.type.startsWith("image/")) out.push(f);
    }
  }
  return dedupeFiles(out);
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const res: File[] = [];
  for (const f of files) {
    const key = `${f.name}:${f.size}:${f.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    res.push(f);
  }
  return res;
}
