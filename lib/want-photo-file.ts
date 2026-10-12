import { promises as fs } from "fs";
import path from "path";

/** Best-effort removal of a customer Want photo stored under `public/uploads/wants/`. */
export async function removeWantPhotoFile(url: string | null | undefined) {
  const name = url?.startsWith("/uploads/wants/") ? url.slice("/uploads/wants/".length) : "";
  if (!/^[\w.-]+$/.test(name)) return;
  await fs.unlink(path.join(process.cwd(), "public", "uploads", "wants", name)).catch(() => undefined);
}
