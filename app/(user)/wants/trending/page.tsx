import Link from "next/link";
import { wantTrendService } from "@/lib/want-trend-service";
import { WantCard } from "@/components/user/WantCard";
export const dynamic = "force-dynamic";
export default async function TrendingWantsPage() {
  let wants: Awaited<ReturnType<typeof wantTrendService>> = []; let unavailable = false;
  try { wants = await wantTrendService(); } catch { unavailable = true; }
  return <main className="mx-auto max-w-7xl px-4 py-10"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Trending Wants</h1><p className="mt-2">Ranked by real customer interest — recent activity and growth, not vendor offers.</p></div><Link href="/wants" className="rounded-xl bg-brand-soft px-5 py-3 font-bold">Browse & filter all Wants</Link></div>{unavailable ? <p role="alert">Trending Wants are temporarily unavailable. Please try again later.</p> : wants.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{wants.map(w => <WantCard key={w.id} want={w} />)}</div> : <p className="mt-6 rounded-2xl bg-white p-6">No trending Wants yet. Be the first to post one.</p>}</main>;
}
