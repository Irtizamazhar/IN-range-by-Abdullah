import Link from "next/link";
import { wantTrendService } from "@/lib/want-trend-service";
import { WantCard } from "@/components/user/WantCard";
import { readCategories } from "@/lib/categories-store";
export const dynamic = "force-dynamic";
export default async function WantsPage({ searchParams }: { searchParams: { city?: string; category?: string; sort?: string } }) {
  let wants: Awaited<ReturnType<typeof wantTrendService>> = []; let unavailable = false;
  const categories = await readCategories().catch(() => []);
  try { wants = await wantTrendService({ ...searchParams, newest: searchParams.sort === "newest" }); } catch { unavailable = true; }
  return <main className="mx-auto max-w-7xl px-4 py-10"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Wants</h1><p className="mt-2">Jo chahiye, market ko batao.</p></div><Link href="/wants/new" className="rounded-xl bg-brand-primary px-5 py-3 font-bold">Post a Want</Link></div><nav className="my-6 flex flex-wrap gap-4"><Link href="/wants/trending">Trending</Link><Link href="/wants?sort=newest">Newest</Link><Link href="/account?tab=wants">My Wants</Link></nav><form className="mb-6 flex flex-wrap gap-3"><label className="text-sm">Near you<input name="city" defaultValue={searchParams.city} placeholder="City" className="ml-2 rounded-xl border p-3" /></label><label className="text-sm">Category<select name="category" defaultValue={searchParams.category || ""} className="ml-2 rounded-xl border p-3"><option value="">All categories</option>{categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label><button className="rounded-xl bg-brand-soft px-4 py-2">Find Wants</button></form>{unavailable ? <p role="alert">Wants are temporarily unavailable. Please try again later.</p> : wants.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{wants.map(w => <WantCard key={w.id} want={w} />)}</div> : <p className="rounded-2xl bg-white p-6">No open Wants match yet. Be the first to post one.</p>}</main>;
}
