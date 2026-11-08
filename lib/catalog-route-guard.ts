import { prisma } from "@/lib/prisma";
import { indexableProductWhere } from "@/lib/seo-data";
import { productPath } from "@/lib/catalog-urls";
import { notFound, permanentRedirect } from "next/navigation";

/** Runs before the root shell can stream; page-level redirects alone can become HTTP 200. */
export async function guardCatalogRoute(context: string | null) {
  if (!context) return;
  const url = new URL(context, "https://joro.pk");
  const match = /^\/(products|categories|category|new-arrivals)\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return;
  let reference: string;
  try { reference = decodeURIComponent(match[2]); } catch { notFound(); }
  let destination: string;
  if (match[1] === "products" || match[1] === "new-arrivals") {
    const where = match[1] === "new-arrivals"
      ? /^\d+$/.test(reference) && Number.isSafeInteger(Number(reference)) ? { legacyNewArrivalId: Number(reference) } : null
      : { OR: [{ id: reference }, { slug: reference }] };
    if (!where) notFound();
    const product = await prisma.product.findFirst({ where: { AND: [indexableProductWhere, where] }, select: { id: true, slug: true } });
    if (!product) notFound();
    destination = productPath(product);
  } else {
    const category = await prisma.category.findFirst({ where: { isActive: true, products: { some: indexableProductWhere }, OR: [{ slug: reference }, { id: reference }, ...(/^\d+$/.test(reference) && Number.isSafeInteger(Number(reference)) ? [{ legacyId: Number(reference) }] : [])] }, select: { slug: true } });
    if (!category) notFound();
    destination = "/categories/" + encodeURIComponent(category.slug);
  }
  if (url.pathname !== destination) permanentRedirect(destination + url.search);
}
