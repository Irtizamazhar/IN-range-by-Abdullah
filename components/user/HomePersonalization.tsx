"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { ArrowRight, Package, Sparkles, Store, Users, X } from "lucide-react";
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
    return <section aria-label="Vendor quick links" className="mx-auto max-w-site px-4 pt-7 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Your JORO Store</p><h2 className="mt-1 text-xl font-black text-emerald-950">Welcome back, {vendor.ownerName.split(/\s+/)[0]}.</h2><p className="mt-1 text-sm text-neutral-600">{vendor.status === "approved" ? "Manage your listings and customer requests." : "Check your application and complete the next steps."}</p></div><div className="flex flex-wrap gap-2"><Link href={entry.href} className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white">{entry.label}</Link>{vendor.status === "approved" && <><Link href="/vendor/dashboard/products" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">My Products</Link><Link href="/vendor/dashboard/services" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">My Services</Link><Link href="/vendor/dashboard/demand" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">Customer Requests</Link><Link href="/vendor/dashboard/offers" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900">My Submitted Offers</Link></>}</div></div></section>;
  }
  const activity = result?.id === customerId ? result.activity : null;
  if (!activity && !loading && !error) return null;
  const firstName = activity?.name.trim().split(/\s+/)[0] || "there";
  const cards = activity ? [
    { title: "My Requests", count: activity.counts.wants, icon: Package, art: "/images/activity/my-requests.webp", artSize: [269, 320], href: "/wants?tab=mine", action: "View My Requests", empty: "You haven't posted a request yet.", emptyHref: "/wants/new", emptyAction: "Post Your First Want", rows: activity.wants },
    { title: "Joined Requests", count: activity.counts.joined, icon: Users, art: "/images/activity/joined-requests.webp", artSize: [300, 320], href: "/wants?tab=joined", action: "View Joined Requests", empty: "No joined requests yet.", emptyHref: "/wants", emptyAction: "Explore Requests", rows: activity.joined },
    { title: "My Private Offers", count: activity.counts.offers, icon: Store, art: "/images/activity/private-offers.webp", artSize: [265, 320], href: "/wants?tab=mine", action: "View My Requests", empty: "Offers for your requests will appear here.", emptyHref: "/wants?tab=mine", emptyAction: "View My Requests", rows: activity.wants.filter(want => want.offers > 0) },
  ] : [];

  async function dismissWelcome() {
    if (!activity?.welcomeId) return;
    const response = await fetch("/api/customer/home-activity", { method: "PATCH", cache: "no-store" });
    if (response.ok) setResult({ id: customerId!, activity: { ...activity, welcomeId: null } });
    else setError("Could not dismiss the welcome. Please try again.");
  }

  return <section aria-label="Your JORO Activity" className="mx-auto max-w-site px-4 pt-7 sm:px-6">
    {activity?.welcomeId && <div className="relative mb-5 overflow-hidden rounded-2xl bg-emerald-950 p-5 text-white shadow-sm sm:p-6"><button type="button" onClick={dismissWelcome} aria-label="Dismiss welcome" className="absolute right-3 top-3 rounded-lg p-1 text-white/80 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300"><X className="h-5 w-5"/></button><p className="text-xs font-black uppercase tracking-wider text-lime-300">Welcome to the family</p><h2 className="mt-1 text-2xl font-black">Welcome to JORO, {firstName}!</h2><p className="mt-1 max-w-2xl text-sm text-white/80">Your marketplace journey starts here. Discover products, explore services, and post your first request.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/products" className="rounded-lg bg-lime-300 px-3 py-2 text-sm font-bold text-emerald-950">Explore Products</Link><Link href="/wants/new" className="rounded-lg border border-white/40 px-3 py-2 text-sm font-bold">Post Your First Want</Link><Link href="/services" className="rounded-lg border border-white/40 px-3 py-2 text-sm font-bold">Explore Services</Link></div></div>}
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF6DC] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 sm:text-xs"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Your JORO Activity</p>
        <h2 className="mt-2.5 break-words text-[26px] font-black leading-tight tracking-tight text-emerald-950 sm:text-3xl lg:text-[34px]">{activity?.welcomeId ? "Your marketplace starts here" : <>Welcome back, {firstName}! <span aria-hidden="true">👋</span></>}</h2>
        <p className="mt-1.5 text-sm text-neutral-600 sm:text-base">{activity?.welcomeId ? "A quick look at your JORO activity." : "Here’s what’s happening with your JORO requests."}</p>
      </div>
      <Link href="/account?tab=orders" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#CFE5B8] bg-white px-5 text-sm font-bold text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-[#F6FBF0] sm:text-base"><Package className="h-[18px] w-[18px]" aria-hidden="true" />My Orders{activity && ` (${activity.counts.orders})`}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </div>
    {loading && <div role="status" className="rounded-xl border bg-white p-5 text-sm text-neutral-600">Loading your activity…</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700">{error}</div>}
    {activity && <div className="grid gap-3 lg:grid-cols-3">{cards.map((card, index) => <article key={card.title} className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E4EFDC] bg-white p-4 shadow-sm sm:p-5">
      <span className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-[radial-gradient(80%_70%_at_85%_100%,#EAF6DC_0%,rgba(234,246,220,0)_70%)]" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 font-bold text-emerald-950"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF6DC] text-emerald-800"><card.icon className="h-4 w-4" aria-hidden="true" /></span><span className="truncate">{card.title}</span></h3>
        <span className="shrink-0 rounded-full bg-[#E3F5C8] px-2.5 py-0.5 text-sm font-black text-emerald-900">{card.count}</span>
      </div>
      {card.rows.length ? <ul className="mt-3 space-y-2">{card.rows.map(row => <li key={row.id} className="min-w-0 border-b border-neutral-100 pb-2 last:border-0"><Link href={`/wants/${row.id}`} className="block truncate text-sm font-semibold text-neutral-800 hover:text-emerald-800">{row.title}</Link><span className="text-xs text-neutral-500">{statusLabel(row)}</span></li>)}</ul> : <p className="mt-3 text-sm text-neutral-600">{card.empty}</p>}
      <div className="mt-auto pr-14 pt-4">
        <Link href={card.count ? card.href : card.emptyHref} className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold transition ${index === 0 ? "bg-[#0B4A2E] text-white shadow-[0_6px_14px_rgba(11,74,46,0.22)] hover:bg-[#0F5C39]" : "border-2 border-[#CFE5B8] bg-white text-emerald-900 hover:border-emerald-300 hover:bg-[#F6FBF0]"}`}>{card.count ? card.action : card.emptyAction}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        <Image src={card.art} alt="" width={card.artSize[0]} height={card.artSize[1]} unoptimized className="pointer-events-none absolute bottom-4 right-4 h-auto w-[40px] object-contain sm:bottom-5 sm:right-5" />
      </div>
    </article>)}</div>}
  </section>;
}
