import { createHash } from "node:crypto";
import { slugBase } from "./catalog-urls";
export type SlugRow = { id: string; name: string; slug: string | null };
export function catalogFingerprint(rows: SlugRow[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
export function planProductSlugs(rows: SlugRow[]) {
  const used = new Set(rows.map(row => row.id.toLowerCase()));
  for (const row of rows) if (row.slug !== null) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || row.slug.length > 191) throw new Error("Invalid existing slug: " + row.id);
    if (used.has(row.slug.toLowerCase())) throw new Error("Existing slug collides with another slug or ID: " + row.id);
    used.add(row.slug.toLowerCase());
  }
  return rows.filter(row => row.slug === null).map(row => {
    const base = slugBase(row.name);
    let slug = base, suffix = 2;
    while (used.has(slug.toLowerCase())) slug = base + "-" + suffix++;
    used.add(slug.toLowerCase());
    return { id: row.id, slug };
  });
}
