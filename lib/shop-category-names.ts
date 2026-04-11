/** Same category list source as admin: GET /api/categories */

export const SHOP_CATEGORY_FALLBACK = ["Other"] as const;

export type ShopCategoryRow = { id: number; name: string };

export function parseShopCategoriesFromApi(data: unknown): ShopCategoryRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((x) => ({
      id: Number((x as { id?: unknown }).id),
      name: String((x as { name?: unknown }).name ?? "").trim(),
    }))
    .filter((row) => Number.isFinite(row.id) && row.name.length > 0);
}

/** Client-only: loads admin-managed shop categories for vendor UIs. */
export async function fetchShopCategoryNameList(): Promise<string[]> {
  try {
    const r = await fetch("/api/categories", { cache: "no-store" });
    if (!r.ok) return [...SHOP_CATEGORY_FALLBACK];
    const rows = parseShopCategoriesFromApi(await r.json()).map((x) => x.name);
    return rows.length > 0 ? rows : [...SHOP_CATEGORY_FALLBACK];
  } catch {
    return [...SHOP_CATEGORY_FALLBACK];
  }
}
