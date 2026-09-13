import type { Prisma } from "@prisma/client";

/** Words that would be confusing or collide with real/likely future app routes under /stores/. */
export const RESERVED_STORE_SLUGS = new Set([
  "new", "edit", "add", "create", "delete", "remove", "update",
  "admin", "administrator", "api", "app", "login", "logout", "register",
  "signup", "signin", "settings", "dashboard", "account", "me", "you",
  "null", "undefined", "true", "false", "index", "home", "store", "stores",
  "vendor", "vendors", "customer", "customers", "product", "products",
  "checkout", "cart", "order", "orders", "search", "help", "support",
  "about", "contact", "terms", "privacy", "qr", "follow", "unfollow",
]);

export function slugifyStoreName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "store";
}

export function isReservedOrInvalidSlug(slug: string): boolean {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return true;
  if (slug.length < 3 || slug.length > 80) return true;
  return RESERVED_STORE_SLUGS.has(slug);
}

type SlugDb = Pick<Prisma.TransactionClient, "vendor" | "storeSlugAlias"> | { vendor: Prisma.TransactionClient["vendor"]; storeSlugAlias: Prisma.TransactionClient["storeSlugAlias"] };

/**
 * Finds a unique, non-reserved slug derived from `shopName`, avoiding collisions with
 * any other vendor's id, any vendor's current storeSlug, and any recorded StoreSlugAlias.
 * Does not persist anything -- caller assigns it inside its own transaction.
 */
export async function generateUniqueStoreSlug(
  db: SlugDb,
  shopName: string,
  excludeVendorId?: string
): Promise<string> {
  const base = slugifyStoreName(shopName);
  const candidates = [base, ...Array.from({ length: 50 }, (_, i) => `${base}-${i + 2}`)];
  for (const candidate of candidates) {
    if (isReservedOrInvalidSlug(candidate)) continue;
    const [vendorConflict, aliasConflict] = await Promise.all([
      db.vendor.findFirst({
        where: { OR: [{ id: candidate }, { storeSlug: candidate }], ...(excludeVendorId ? { NOT: { id: excludeVendorId } } : {}) },
        select: { id: true },
      }),
      db.storeSlugAlias.findUnique({ where: { slug: candidate }, select: { vendorId: true } }),
    ]);
    if (!vendorConflict && (!aliasConflict || aliasConflict.vendorId === excludeVendorId)) return candidate;
  }
  // Extremely unlikely fallback: base name is fully saturated across 50 numbered variants.
  return `store-${Math.random().toString(36).slice(2, 10)}`;
}
