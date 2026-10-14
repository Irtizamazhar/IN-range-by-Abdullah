"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, Package, Store, Users, X } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { useVendorAuth } from "@/context/VendorAuthContext";
import { vendorEntry } from "@/lib/vendor-entry";

type Activity = {
  customerId: string;
  name: string;
  welcomeId: string | null;
  counts: { wants: number; joined: number; offers: number; orders: number };
  wants: { id: string; title: string; status: string; expiresAt: string; offers: number }[];
  joined: { id: string; title: string; status: string; expiresAt: string }[];
};

function statusLabel(row: { status: string; expiresAt: string }) {
  if (row.status === "OPEN" && new Date(row.expiresAt).getTime() <= Date.now()) return "Closed";
  return row.status.replaceAll("_", " ").toLowerCase().replace(/^./, value => value.toUpperCase());
}

export function HomePersonalization() {
  const { data: session, status } = useSession();
  const { vendor, loading: vendorLoading } = useVendorAuth();
  const customerId = session?.user?.role === "customer" ? session.user.id : undefined;
  const [result, setResult] = useState<{ id: string; activity: Activity } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setResult(null);
    setError("");
    if (!customerId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/customer/home-activity", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your activity.");
        if (data.customerId !== customerId) throw new Error("Your account changed. Please refresh.");
        setResult({ id: customerId, activity: data as Activity });
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load your activity."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [customerId]);

  if (status === "loading" || vendorLoading) return null;
  if (!customerId) {
    if (!vendor) return null;
    const entry = vendorEntry(vendor.status);
    return <section aria-label="Vendor quick links" className="mx-auto max-w-7xl px-4 pt-7 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Your JORO Store</p><h2 className="mt-1 text-xl font-black text-emerald-950">Welcome back, {vendor.ownerName.split(/\s+/)[0]}.</h2><p className="mt-1 text-sm text-neutral-600">{vendor.status === "approved" ? "Manage your listings and customer requests." : "Check your application and complete the next steps."}</p></div><div className="flex flex-wrap gap-2"><Link href={entry.href} className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white">{entry.label}</Link>{vendor.status === "approved" && <><Link href="/vendor/dashboard/products" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">My Products</Link><Link href="/vendor/dashboard/services" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">My Services</Link><Link href="/vendor/dashboard/demand" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">Customer Requests</Link><Link href="/vendor/dashboard/offers" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">My Submitted Offers</Link></>}</div></div></section>;
  }
  const activity = result?.id === customerId ? result.activity : null;
  if (!activity && !loading && !error) return null;
  const firstName = activity?.name.trim().split(/\s+/)[0] || "there";
  const cards = activity ? [
    { title: "My Requests", count: activity.counts.wants, icon: Package, href: "/account?tab=wants", action: "View My Requests", empty: "You haven't posted a request yet.", emptyHref: "/wants/new", emptyAction: "Post Your First Want", rows: activity.wants },
    { title: "Joined Requests", count: activity.counts.joined, icon: Users, href: "/wants?tab=joined", action: "View Joined Requests", empty: "No joined requests yet.", emptyHref: "/wants", emptyAction: "Explore Requests", rows: activity.joined },
    { title: "My Private Offers", count: activity.counts.offers, icon: Store, href: "/account?tab=wants", action: "View My Requests", empty: "Offers for your requests will appear here.", emptyHref: "/account?tab=wants", emptyAction: "View My Requests", rows: activity.wants.filter(want => want.offers > 0) },
  ] : [];

  async function dismissWelcome() {
    if (!activity?.welcomeId) return;
    const response = await fetch("/api/customer/home-activity", { method: "PATCH", cache: "no-store" });
    if (response.ok) setResult({ id: customerId!, activity: { ...activity, welcomeId: null } });
    else setError("Could not dismiss the welcome. Please try again.");
  }

  return <section aria-label="Your JORO Activity" className="mx-auto max-w-7xl px-4 pt-7 sm:px-6">
    {activity?.welcomeId && <div className="relative mb-5 overflow-hidden rounded-2xl bg-emerald-950 p-5 text-white shadow-sm sm:p-6"><button type="button" onClick={dismissWelcome} aria-label="Dismiss welcome" className="absolute right-3 top-3 rounded-lg p-1 text-white/80 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300"><X className="h-5 w-5"/></button><p className="text-xs font-black uppercase tracking-wider text-lime-300">Welcome to the family</p><h2 className="mt-1 text-2xl font-black">Welcome to JORO, {firstName}!</h2><p className="mt-1 max-w-2xl text-sm text-white/80">Your marketplace journey starts here. Discover products, explore services, and post your first request.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/products" className="rounded-lg bg-lime-300 px-3 py-2 text-sm font-bold text-emerald-950">Explore Products</Link><Link href="/wants/new" className="rounded-lg border border-white/40 px-3 py-2 text-sm font-bold">Post Your First Want</Link><Link href="/services" className="rounded-lg border border-white/40 px-3 py-2 text-sm font-bold">Explore Services</Link></div></div>}
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Your JORO Activity</p><h2 className="mt-1 text-xl font-black text-emerald-950 sm:text-2xl">{activity?.welcomeId ? "Your marketplace starts here" : `Welcome back, ${firstName}!`}</h2><p className="text-sm text-neutral-600">{activity?.welcomeId ? "A quick look at your JORO activity." : "Here’s what’s happening with your JORO requests."}</p></div><Link href="/account?tab=orders" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800">My Orders{activity && ` (${activity.counts.orders})`}<ArrowRight className="h-4 w-4"/></Link></div>
    {loading && <div role="status" className="rounded-xl border bg-white p-5 text-sm text-neutral-600">Loading your activity…</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700">{error}</div>}
    {activity && <div className="grid gap-3 md:grid-cols-3">{cards.map(card => <article key={card.title} className="min-w-0 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold text-emerald-950"><card.icon className="h-5 w-5 text-emerald-700"/>{card.title}</h3><span className="rounded-full bg-lime-100 px-2.5 py-0.5 text-sm font-black text-emerald-900">{card.count}</span></div>{card.rows.length ? <ul className="mt-3 space-y-2">{card.rows.map(row => <li key={row.id} className="min-w-0 border-b border-neutral-100 pb-2 last:border-0"><Link href={`/wants/${row.id}`} className="block truncate text-sm font-semibold text-neutral-800 hover:text-emerald-800">{row.title}</Link><span className="text-xs text-neutral-500">{statusLabel(row)}</span></li>)}</ul> : <p className="mt-3 text-sm text-neutral-600">{card.empty}</p>}<Link href={card.count ? card.href : card.emptyHref} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-800 hover:underline">{card.count ? card.action : card.emptyAction}<ArrowRight className="h-4 w-4"/></Link></article>)}</div>}
  </section>;
}
