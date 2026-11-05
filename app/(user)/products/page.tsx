import { notFound } from "next/navigation";
import { ProductsClient } from "./ProductsClient";
import { pageMetadata } from "@/lib/seo";
import { catalogParams, readSeoCatalog } from "@/lib/seo-catalog";
import { shouldNoindex } from "@/lib/seo-policy";

export const dynamic = "force-dynamic";
type Props = { searchParams?: Record<string, string | string[] | undefined> };
export async function generateMetadata({ searchParams }: Props) {
  const params = catalogParams(searchParams), page = Number(params.get("page") || "1");
  if (!await readSeoCatalog(params.toString())) notFound();
  return pageMetadata("Products in Pakistan" + (page > 1 ? ` — Page ${page}` : ""), "Shop public product listings on JORO.PK. Browse categories, compare actual prices and find products from Pakistan's marketplace.", "/products" + (page > 1 ? `?page=${page}` : ""), undefined, shouldNoindex("/products", params));
}
export default async function ProductsPage({ searchParams }: Props) {
  const params = catalogParams(searchParams);
  const initial = await readSeoCatalog(params.toString());
  if (!initial) notFound();
  return <ProductsClient key={initial.key + ":" + initial.page} initial={initial} />;
}
