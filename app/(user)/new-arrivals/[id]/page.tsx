import { requestCache as cache } from "@/lib/seo-cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { indexableProductWhere } from "@/lib/seo-data";
import { pageMetadata } from "@/lib/seo";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
import NewArrivalDetailClient from "./NewArrivalDetailClient";
export const dynamic = "force-dynamic";
const legacyProduct = cache(async (id: string) => {
  if (!/^[0-9]+$/.test(id) || !Number.isSafeInteger(Number(id))) return null;
  return prisma.product.findFirst({ where: { ...indexableProductWhere, legacyNewArrivalId: Number(id) }, select: catalogProductSelect() });
});
export async function generateMetadata({ params }: { params: { id: string } }) {
  const product = await legacyProduct(params.id); if (!product) notFound();
  return pageMetadata(product.name, product.description, `/products/${encodeURIComponent(product.id)}`, serializeProduct(product).images[0]);
}
export default async function NewArrivalPage({ params }: { params: { id: string } }) {
  if (!await legacyProduct(params.id)) notFound();
  return <NewArrivalDetailClient />;
}
