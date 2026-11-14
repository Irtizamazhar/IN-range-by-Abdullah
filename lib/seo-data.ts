import { requestCache as cache } from "@/lib/seo-cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";

export const indexableProductWhere: Prisma.ProductWhereInput = {
  isActive: true, OR: [{ vendorPublication: { is: null } }, { vendorPublication: { is: { status: "active", vendor: { status: "approved" } } } }],
};
export const indexableServiceWhere: Prisma.ServiceOfferingWhereInput = { active: true, moderationStatus: "APPROVED", vendor: { status: "approved" } };
export const indexableStoreWhere: Prisma.VendorWhereInput = { status: "approved" };
export const indexableWantWhere = (now = new Date()): Prisma.WantWhereInput => ({ status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true } });

export const seoProduct = cache(async (id: string) => prisma.product.findFirst({ where: { ...indexableProductWhere, OR: [{ id }, { slug: id }], AND: [indexableProductWhere] }, select: {
  ...catalogProductSelect(), vendorPublication: { select: { status: true, vendor: { select: { shopName: true, storeSlug: true, id: true } } } },
} }));
export const seoService = cache(async (id: string) => prisma.serviceOffering.findFirst({ where: { ...indexableServiceWhere, id }, select: {
  id: true, name: true, description: true, type: true, price: true, priceType: true, cities: true, imageUrl: true, catalog: { select: { imageUrl: true } }, vendor: { select: { id: true, shopName: true, storeSlug: true } },
} }));
export const seoStore = cache(async (slug: string) => {
  const direct = await prisma.vendor.findFirst({ where: { ...indexableStoreWhere, OR: [{ id: slug }, { storeSlug: slug }] }, select: {
    id: true, shopName: true, shopDescription: true, storeSlug: true, shopLogo: true, storeBanner: true, city: true,
  } });
  if (direct) return direct;
  const alias = await prisma.storeSlugAlias.findUnique({ where: { slug }, select: { vendorId: true } });
  return alias ? prisma.vendor.findFirst({ where: { ...indexableStoreWhere, id: alias.vendorId }, select: {
    id: true, shopName: true, shopDescription: true, storeSlug: true, shopLogo: true, storeBanner: true, city: true,
  } }) : null;
});
export const seoCategory = cache(async (slug: string) => prisma.category.findFirst({ where: { OR: [{ slug }, { id: slug }, ...(/^\d+$/.test(slug) ? [{ legacyId: Number(slug) }] : [])], isActive: true, products: { some: indexableProductWhere } }, select: { id: true, name: true, slug: true, image: true } }));
/** Homepage navigation must only advertise categories whose public landing page is eligible. */
export const seoHomepageCategories = cache(async () => prisma.category.findMany({
  where: { isActive: true, products: { some: indexableProductWhere } },
  select: { id: true, name: true, slug: true, image: true, showOnHome: true, sortOrder: true },
  orderBy: [{ showOnHome: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  take: 10,
}));
export const seoWant = cache(async (id: string) => prisma.want.findFirst({ where: { id, ...indexableWantWhere() }, select: { id: true, title: true, description: true, city: true, category: true, photo: true, updatedAt: true } }));
