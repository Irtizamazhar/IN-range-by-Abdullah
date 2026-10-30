import Link from "@/components/ui/LoadingLink";
import { ProductCard } from "@/components/user/ProductCard";
import { CategoryFilterRail } from "@/components/user/CategoryFilterRail";
import { giftProducts } from "@/lib/gift-products";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function GiftsPage({ searchParams }: { searchParams?: { search?: string; category?: string } }) {
  const search = (searchParams?.search || "").trim().slice(0, 100);
  const category = (searchParams?.category || "").trim().slice(0, 100);
  const [products, categories] = await Promise.all([
    giftProducts({ search, category }),
    prisma.product.findMany({ where: { isActive: true, OR: ["gift", "flower", "bouquet", "hamper", "birthday", "anniversary", "wedding"].map(term => ({ category: { contains: term } })) }, distinct: ["category"], select: { category: true }, take: 50 }),
  ]);
  const categoryNames = Array.from(new Set([...categories.map(item => item.category), ...(category ? [category] : [])]));
  const categoryItems = ["", ...categoryNames].map(value => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (value) params.set("category", value);
    return { value, label: value || "All gifts", href: `/gifts${params.size ? `?${params}` : ""}` };
  });
  return <main className="mx-auto max-w-site px-4 py-8 sm:px-6"><div className="rounded-3xl bg-[#123d27] p-7 text-white sm:p-10"><p className="text-sm font-bold uppercase tracking-widest text-lime-300">JORO gifts</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Thoughtful gifts for every occasion</h1><p className="mt-3 text-white/75">Shop available gifts or tell local sellers what you would like made.</p><Link href="/wants/new?type=gift" className="mt-5 inline-block rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark">Request a custom gift</Link></div>
    <CategoryFilterRail label="Browse gift categories" items={categoryItems} selected={category} />
    <form action="/gifts" className="mt-7 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[2fr_1fr_auto]"><label className="text-sm font-semibold">Search gifts<input name="search" defaultValue={search} maxLength={100} placeholder="Gift, flowers, hamper..." className="mt-1 w-full rounded-xl border px-3 py-2.5" /></label><label className="text-sm font-semibold">Category<select name="category" defaultValue={category} className="mt-1 w-full rounded-xl border px-3 py-2.5"><option value="">All gift categories</option>{categories.map(item => <option key={item.category}>{item.category}</option>)}</select></label><button className="self-end rounded-xl bg-brand-primary px-5 py-2.5 font-bold text-brand-dark">Search</button></form>
    <h2 className="mb-5 mt-8 text-2xl font-black text-emerald-950">Available gifts</h2>{products.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map(product => <ProductCard key={product._id} product={product} variant="marketplace" />)}</div> : <div className="rounded-2xl border bg-white p-8 text-center"><p>No matching gift products are available right now.</p><Link href="/wants/new?type=gift" className="mt-3 inline-block font-bold text-emerald-800 underline">Request a custom gift</Link></div>}
  </main>;
}
