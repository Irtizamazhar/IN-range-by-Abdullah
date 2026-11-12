import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { incrementalFeatures } from "@/lib/incremental-features";
import { ApiError } from "@/lib/marketplace-api";
import { indexableProductWhere } from "@/lib/seo-data";
import { catalogProductSelect } from "@/lib/catalog-product-select";
export const promotionDestination = z.string().trim().max(500).regex(/^\/(?:products|categories|stores)(?:\/[a-zA-Z0-9_-]+)?$/, "Choose a public product, category or store URL.");
export const homepagePromotionInput = z.object({ id: z.string().optional(), title: z.string().trim().min(1).max(160), subtitle: z.string().trim().max(300).default(""), href: promotionDestination, image: z.string().max(1000).regex(/^\/uploads\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp)$/i).nullable().default(null), placement: z.enum(["STRIP","BANNER","MID","LOWER"]), enabled: z.boolean(), position: z.number().int().min(0).max(1000), startAt: z.string().datetime().nullable(), endAt: z.string().datetime().nullable() }).refine(row => !row.startAt || !row.endAt || new Date(row.endAt) > new Date(row.startAt), { message: "End must follow start." });
export async function verifyPromotionDestination(href: string) {
  const [kind, ref] = href.slice(1).split("/");
  if (!ref) return;
  const exists = kind === "products" ? await prisma.product.findFirst({ where: { slug: ref, AND: [indexableProductWhere] }, select: { id: true } }) : kind === "categories" ? await prisma.category.findFirst({ where: { slug: ref, isActive: true, products: { some: indexableProductWhere } }, select: { id: true } }) : await prisma.vendor.findFirst({ where: { storeSlug: ref, status: "approved" }, select: { id: true } });
  if (!exists) throw new ApiError(400, "Choose an active public catalog destination.");
}
export async function homepageAdditions() {
  if (!incrementalFeatures().promotions) return { promotions: [], featured: null };
  const now = new Date();
  const [rows, featured] = await Promise.all([prisma.homepagePromotion.findMany({ where: { enabled: true, AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { OR: [{ endAt: null }, { endAt: { gt: now } }] }] }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 12 }), prisma.product.findFirst({ where: { isFeatured: true, stock: { gt: 0 }, AND: [indexableProductWhere] }, select: catalogProductSelect(), orderBy: { updatedAt: "desc" } })]);
  const promotions = [];
  for (const row of rows) { try { promotionDestination.parse(row.href); await verifyPromotionDestination(row.href); promotions.push(row); } catch (e) { if (!(e instanceof ApiError) && !(e instanceof z.ZodError)) throw e; } }
  return { promotions, featured };
}
