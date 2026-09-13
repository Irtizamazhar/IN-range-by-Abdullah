import Link from "next/link";
import { Clock3, MapPin, MessageSquareMore, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPKR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WantsPage({ searchParams }: { searchParams: { search?: string; category?: string } }) {
  const search = String(searchParams.search || "").trim();
  const category = String(searchParams.category || "").trim();
  const wants = await prisma.wantPost.findMany({
    where: {
      status: "open",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(category ? { category } : {}),
      ...(search
        ? { AND: [{ OR: [{ title: { contains: search } }, { description: { contains: search } }] }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { offers: true } } },
  });
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-brand-link">Real customer demand</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-brand-dark">Wants marketplace</h1>
          <p className="mt-2 max-w-2xl text-base text-darkText/65">
            Customers post what they need. Approved sellers can respond with a database-backed offer.
          </p>
        </div>
        <Link href="/wants/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-black text-brand-dark hover:bg-brand-hover">
          <Plus className="h-4 w-4" /> Post a Want
        </Link>
      </div>

      <form className="mt-7 grid gap-3 rounded-2xl border border-borderGray bg-white p-4 shadow-card sm:grid-cols-[1fr_220px_auto]">
        <label className="relative">
          <span className="sr-only">Search Wants</span>
          <Search className="absolute left-3 top-3 h-4 w-4 text-darkText/35" />
          <input name="search" defaultValue={search} placeholder="Search customer needs" className="w-full rounded-xl border border-borderGray py-2.5 pl-10 pr-3 text-sm" />
        </label>
        <select name="category" defaultValue={category} className="rounded-xl border border-borderGray px-3 py-2.5 text-sm">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item.name}>{item.name}</option>)}
        </select>
        <button className="rounded-xl bg-brand-dark px-5 py-2.5 text-sm font-bold text-white">Filter</button>
      </form>

      {wants.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {wants.map((want) => (
            <Link key={want.id} href={`/wants/${want.id}`} className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary/45">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-black text-brand-link">{want.category}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-darkText/45"><Clock3 className="h-3 w-3" />{want.createdAt.toLocaleDateString("en-PK")}</span>
              </div>
              <h2 className="mt-4 text-lg font-black leading-6 text-brand-dark">{want.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-5 text-darkText/60">{want.description}</p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold text-darkText/60"><MapPin className="h-4 w-4" />{want.city}</span>
                <span className="font-black text-brand-link">
                  {want.budgetMax ? `Up to ${formatPKR(Number(want.budgetMax))}` : "Budget flexible"}
                </span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-darkText/50"><MessageSquareMore className="h-4 w-4" />{want._count.offers} seller offers</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-borderGray bg-white p-12 text-center">
          <h2 className="font-bold text-brand-dark">No open Wants match this filter</h2>
          <p className="mt-1 text-sm text-darkText/55">Post what you need and it will appear after moderation.</p>
        </div>
      )}
    </main>
  );
}
