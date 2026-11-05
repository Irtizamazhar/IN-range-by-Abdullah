import Link from "@/components/ui/LoadingLink";
import { prisma } from "@/lib/prisma";
import { indexableProductWhere } from "@/lib/seo-data";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata("Product Categories in Pakistan", "Browse JORO.PK product categories with public marketplace listings. Explore actual products, prices and availability.", "/categories");
export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ where: { isActive: true, products: { some: indexableProductWhere } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" }, take: 1000 });
  return <main className="mx-auto max-w-site px-4 py-8"><h1 className="text-3xl font-black text-[#005055]">Product categories</h1><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categories.map(category => <Link key={category.id} href={`/categories/${encodeURIComponent(category.slug)}`} className="rounded-xl border bg-white p-4 font-bold text-[#005055]">{category.name}</Link>)}</div></main>;
}
