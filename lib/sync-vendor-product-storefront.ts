import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseImagesJson } from "@/lib/vendor-product-schemas";

type StorefrontDb = {
  vendorProduct: typeof prisma.vendorProduct;
  product: typeof prisma.product;
};

/**
 * Keeps `Product` in sync for approved vendor listings so `/products`, checkout,
 * and New Arrivals can use the main catalog.
 */
export async function syncVendorProductStorefront(
  vendorProductId: string,
  db: StorefrontDb = prisma
): Promise<void> {
  const vp = await db.vendorProduct.findUnique({
    where: { id: vendorProductId },
  });
  if (!vp) return;

  const urls = parseImagesJson(vp.images);
  const listingJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    urls.length > 0 ? urls : Prisma.JsonNull;

  const isActive = vp.status === "active";

  const baseData = {
    name: vp.productName,
    description: vp.description,
    price: vp.price,
    originalPrice: null,
    discountPercent: 0,
    category: vp.category,
    stock: vp.stock,
    variants: [] as Prisma.InputJsonValue,
    isActive,
    listingImageUrls: listingJson,
  };

  if (!vp.publishedProductId) {
    if (!isActive) return;
    const publishedAt = new Date();
    const created = await db.product.create({
      data: { ...baseData, createdAt: publishedAt },
    });
    await db.vendorProduct.update({
      where: { id: vp.id },
      data: { publishedProductId: created.id },
    });
    return;
  }

  await db.product.update({
    where: { id: vp.publishedProductId },
    data: baseData,
  });
}

export async function deleteVendorProductAndStorefront(
  vendorProductId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const vp = await tx.vendorProduct.findUnique({
      where: { id: vendorProductId },
      select: { publishedProductId: true },
    });
    if (!vp) return;
    if (vp.publishedProductId) {
      await tx.product.delete({ where: { id: vp.publishedProductId } });
    }
    await tx.vendorProduct.delete({ where: { id: vendorProductId } });
  });
}
