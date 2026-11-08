import { safeRedirectQuery } from "@/lib/catalog-urls";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "@/components/ui/LoadingLink";
import { ProductCard } from "@/components/user/ProductCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, breadcrumbs } from "@/lib/seo";
import { seoCategory } from "@/lib/seo-data";
import { readSeoCatalog } from "@/lib/seo-catalog";
export const dynamic = "force-dynamic";
type Props = { params: { slug: string }; searchParams?: { page?: string } };
export async function generateMetadata({ params, searchParams }: Props) {
  const category = await seoCategory(params.slug); if (!category) notFound();
  const page = Number(searchParams?.page || "1");
  if (!await readSeoCatalog(new URLSearchParams({ category: category.name, page: searchParams?.page || "1" }).toString())) notFound();
  return pageMetadata(`${category.name} in Pakistan${page > 1 ? ` — Page ${page}` : ""}`, `Browse ${category.name} listings on JORO.PK. Compare actual product prices and availability from Pakistan's marketplace.`, `/categories/${encodeURIComponent(category.slug)}${page > 1 ? `?page=${page}` : ""}`, category.image);
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await seoCategory(params.slug); if (!category) notFound();
  if (params.slug !== category.slug) permanentRedirect("/categories/" + encodeURIComponent(category.slug) + safeRedirectQuery(searchParams));
  const data = await readSeoCatalog(new URLSearchParams({ category: category.name, page: searchParams?.page || "1" }).toString()); if (!data) notFound();
  const href = (page: number) => `/categories/${encodeURIComponent(category.slug)}${page > 1 ? `?page=${page}` : ""}`;
  return <main className="mx-auto max-w-site px-4 py-8 sm:px-6">
    <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Categories", path: "/categories" }, { name: category.name, path: href(1) }])} />
    <nav aria-label="Breadcrumb" className="mb-4 flex gap-3 text-sm"><Link href="/products">Products</Link><Link href="/categories">All categories</Link></nav>
    <h1 className="text-3xl font-black text-[#005055]">{category.name}</h1><p className="mt-3 text-gray-600">Browse {data.total} public product listings in {category.name}.</p>
    <Link href={`/products?category=${encodeURIComponent(category.name)}`} className="my-5 inline-block rounded-xl bg-[#B8E632] px-4 py-3 font-bold text-[#005055]">Filter and sort products</Link>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{data.products.map(product => <ProductCard key={product._id} product={product} variant="marketplace" showNewTag />)}</div>
    <nav aria-label="Category pages" className="mt-7 flex items-center gap-5">{data.page > 1 && <Link href={href(data.page - 1)}>Previous page</Link>}<span>Page {data.page} of {data.totalPages}</span>{data.page < data.totalPages && <Link href={href(data.page + 1)}>Next page</Link>}</nav>
  </main>;
}
