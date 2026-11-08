import { productPath, safeRedirectQuery } from "@/lib/catalog-urls";
import { requestCache as cache } from "@/lib/seo-cache";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { indexableProductWhere } from "@/lib/seo-data";
import { pageMetadata } from "@/lib/seo";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
export const dynamic = "force-dynamic";
const legacyProduct = cache(async (id: string) => {
  if (!/^[0-9]+$/.test(id) || !Number.isSafeInteger(Number(id))) return null;
  return prisma.product.findFirst({ where: { ...indexableProductWhere, legacyNewArrivalId: Number(id) }, select: catalogProductSelect() });
});
export async function generateMetadata({ params }: { params: { id: string } }) {
  const product = await legacyProduct(params.id); if (!product) notFound();
  return pageMetadata(product.name, product.description, productPath(product), serializeProduct(product).images[0]);
}
export default async function NewArrivalPage({ params, searchParams }: { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  const product = await legacyProduct(params.id);
  if (!product) notFound();
  permanentRedirect(productPath(product) + safeRedirectQuery(searchParams));
}
