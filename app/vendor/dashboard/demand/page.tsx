import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorWantMatchService } from "@/lib/vendor-want-match-service";
import { WantCard } from "@/components/user/WantCard";
export const dynamic = "force-dynamic";
export default async function DemandPage() {
  const session = await getVendorFromSession({ allowUnapproved: true }); if (!session) redirect("/vendor/login");
  if (session.vendor.status !== "approved") return <main className="p-6"><h1 className="text-3xl font-bold">Customer Demand</h1><p className="my-4">Your store must be approved before you can browse customer demand.</p></main>;
  const matches = await vendorWantMatchService(session.vendor.id);
  const matching = matches.filter(m => m.score > 0);
  const others = matches.filter(m => m.score === 0);
  return <main className="p-6"><h1 className="text-3xl font-bold">Customer Demand</h1><p className="my-4">Open Wants recommended from your store category, catalog, city, and product prices.</p>
    <h2 className="mb-3 text-xl font-bold">Matching for you</h2>
    <div className="grid gap-4 lg:grid-cols-2">{matching.map(m => <section key={m.want.id} className="rounded-2xl border bg-white p-4"><p className="mb-3 font-bold text-brand-link">{m.score}/100 relevance</p><WantCard want={m.want} /><Link href={`/vendor/dashboard/demand/${m.want.id}`} className="mt-3 block font-bold text-brand-link">View demand & submit offer →</Link><ul className="mt-3 list-inside list-disc text-sm">{m.reasons.map(r => <li key={r}>{r}</li>)}</ul></section>)}</div>
    {!matching.length && <p>No Wants match your store yet.</p>}
    <h2 className="mb-3 mt-8 text-xl font-bold">All open Wants</h2>
    <div className="grid gap-4 lg:grid-cols-2">{others.map(m => <section key={m.want.id} className="rounded-2xl border bg-white p-4"><WantCard want={m.want} /><Link href={`/vendor/dashboard/demand/${m.want.id}`} className="mt-3 block font-bold text-brand-link">View demand & submit offer →</Link></section>)}</div>
    {!others.length && !matching.length && <p>No open customer Wants yet.</p>}
    {!others.length && matching.length > 0 && <p className="text-darkText/60">All open Wants currently match your store.</p>}
  </main>;
}