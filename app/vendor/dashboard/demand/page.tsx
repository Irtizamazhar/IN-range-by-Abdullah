import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorWantMatchService } from "@/lib/vendor-want-match-service";
import { WantCard } from "@/components/user/WantCard";
export const dynamic = "force-dynamic";
export default async function DemandPage() {
  const session = await getVendorFromSession(); if (!session) redirect("/vendor/login");
  const matches = await vendorWantMatchService(session.vendor.id);
  return <main className="p-6"><h1 className="text-3xl font-bold">Customer Demand</h1><p className="my-4">Open Wants recommended from your store category, catalog, city, and product prices.</p><div className="grid gap-4 lg:grid-cols-2">{matches.map(m => <section key={m.want.id} className="rounded-2xl border bg-white p-4"><p className="mb-3 font-bold text-brand-link">{m.score}/100 relevance</p><WantCard want={m.want} /><Link href={`/vendor/dashboard/demand/${m.want.id}`} className="mt-3 block font-bold text-brand-link">View demand & submit offer →</Link><ul className="mt-3 list-inside list-disc text-sm">{m.reasons.map(r => <li key={r}>{r}</li>)}</ul></section>)}</div>{!matches.length && <p>No open customer Wants yet.</p>}</main>;
}