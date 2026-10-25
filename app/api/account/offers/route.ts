import { prisma } from "@/lib/prisma";
import { api, customerActor } from "@/lib/marketplace-api";
import { productImagesForProduct, type ProductSerializeInput } from "@/lib/serialize";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const customer = await customerActor();
  const offers = await prisma.wantOffer.findMany({ where: { want: { customerId: customer.id } }, include: { vendor: { select: { id: true, shopName: true, status: true, storeSlug: true } }, want: { select: { id: true, title: true, status: true, city: true } }, revisions: { orderBy: { revisionNumber: "desc" }, include: { product: { select: { listingImageUrls: true, productImages: { select: { id: true, sortOrder: true } } } } } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  // Each revision carries its linked product's first image for the offer card; the product itself is not exposed.
  return { offers: offers.map(o => ({ ...o, revisions: o.revisions.map(({ product, ...r }) => ({ ...r, image: product ? productImagesForProduct(product as unknown as ProductSerializeInput)[0] || "" : "" })) })) };
}); }
