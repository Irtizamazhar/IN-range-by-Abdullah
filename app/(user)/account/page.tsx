"use client";
import { PakistanCitySelect } from "@/components/ui/PakistanCitySelect";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/ui/LoadingLink";
import Image from "next/image";
import { ProductCard, type ProductCardData } from "@/components/user/ProductCard";
import gridStyles from "@/components/user/ProductGrid.module.css";
import { accountDestinations } from "@/components/user/AccountNavigation";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { ArrowRight, Search, Bell, ClipboardList, Headset, Heart, MapPin, Package, Settings, ShoppingBag, Store } from "lucide-react";
import { AccountLinkCard, AccountPageHero } from "@/components/user/AccountPageParts";
import { AccountSettingsSection } from "@/components/user/AccountSettingsSection";
import { FollowingSection, type FollowedStore } from "@/components/user/AccountFollowingList";
import { AccountWantCard, PostWantAction, WANT_FILTERS, WantToolbar, WantsEmpty, wantsHref, type AccountWant } from "@/components/user/AccountWantList";
import { ORDER_FILTERS, OrderCard, OrderToolbar, filterLabel, ordersHref, type AccountOrder } from "@/components/user/AccountOrderList";
type Address = { id: string; label: string; recipientName: string; phone: string; address: string; city: string; postalCode: string | null; isDefault: boolean };
type Account = {
  profile: { name: string; email: string; phone: string; createdAt: string; hasLocalPassword: boolean };
  orders: AccountOrder[];
  wants: AccountWant[];
  savedProducts: (ProductCardData & { available: boolean })[];
  followedStores: FollowedStore[];
  addresses: Address[]; counts: Record<string,number>; pagination: { page: number; pageSize: number; orderPages: number; wantPages: number };
};
const fieldClass = "mt-1 block w-full min-w-0 rounded-xl border border-borderGray bg-white px-3 py-2.5 font-normal";
function Empty({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-dashed border-borderGray bg-white p-8 text-center"><h2 className="text-lg font-bold">{title}</h2><p className="mt-2 text-base text-darkText/65">{children}</p></div>; }
export default function AccountPage() {
  const { data: session, status, update } = useSession(); const { openAuthModal } = useCustomerAuth(); const search = useSearchParams();
  const requestedTab = search?.get("tab") || "overview"; const tab = ["overview","orders","wants","saved","stores","addresses","profile"].includes(requestedTab) ? requestedTab : "overview"; const page = Math.max(1, Number.parseInt(search?.get("page") || "1",10) || 1);
  // Orders tab filter and sort (validated against the known filters; the API validates again).
  const orderStatus = tab === "orders" ? ORDER_FILTERS.find(f => f.value === search?.get("status"))?.value ?? null : null; const orderSort = tab === "orders" && search?.get("sort") === "oldest" ? "oldest" : "newest";
  const wantStatus = tab === "wants" ? WANT_FILTERS.find(f => f.value === search?.get("wantStatus"))?.value ?? null : null; const wantSort = tab === "wants" && search?.get("wantSort") === "oldest" ? "oldest" : "newest";
  const customerId = session?.user?.role === "customer" ? session.user.id : "";
  const [data, setData] = useState<Account | null>(null); const [ownerId, setOwnerId] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [editing, setEditing] = useState<Address | "new" | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!customerId) return; setLoading(true);
    try { const r = await fetch(`/api/customer/account?page=${page}${orderStatus ? `&status=${orderStatus}` : ""}${orderSort === "oldest" ? "&sort=oldest" : ""}${wantStatus ? `&wantStatus=${wantStatus}` : ""}${wantSort === "oldest" ? "&wantSort=oldest" : ""}`, { signal, cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load account."); if (!signal?.aborted) { setData(d); setOwnerId(customerId); setError(""); } }
    catch(e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not load account."); } finally { if (!signal?.aborted) setLoading(false); }
  }, [customerId,page,orderStatus,orderSort,wantStatus,wantSort]);
  // Deleting, editing or posting a Want elsewhere on the page (menus, the Post a Want dialog) refreshes the list.
  useEffect(() => { const refresh = () => { void load(); }; window.addEventListener("want-deleted", refresh); window.addEventListener("wants-changed", refresh); return () => { window.removeEventListener("want-deleted", refresh); window.removeEventListener("wants-changed", refresh); }; }, [load]);
  useEffect(() => { setData(null); setEditing(null); const controller = new AbortController(); void load(controller.signal); const refresh = () => { void load(controller.signal); }; window.addEventListener("customer-saved-products-changed",refresh); return () => { controller.abort(); window.removeEventListener("customer-saved-products-changed",refresh); }; }, [load]);
  async function mutate(url: string, method: string, body?: unknown) {
    setError(""); setMessage("");
    try { const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not save changes."); await load(); setMessage("Changes saved."); setEditing(null); return true; }
    catch(e) { setError(e instanceof Error ? e.message : "Could not save changes."); return false; }
  }
  async function saveAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const current = editing && editing !== "new" ? editing : null;
    await mutate(`/api/customer/addresses${current ? `/${current.id}` : ""}`, current ? "PATCH" : "POST", { label: f.get("label"), recipientName: f.get("recipientName"), phone: f.get("phone"), address: f.get("address"), city: f.get("city"), postalCode: f.get("postalCode") || null, isDefault: f.get("isDefault") === "on" });
  }
  async function saveProfile(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const name = String(f.get("name")); const phone = String(f.get("phone")); if (await mutate("/api/customer/profile","PATCH",{ name,phone })) { try { const response = await fetch("/api/customer/profile", { cache: "no-store" }); if (!response.ok) throw new Error("Session refresh failed"); const result = await response.json(); await update({ name: result.name, phone: result.phone }); } catch { setMessage("Profile saved. Refresh to update your session display."); } } }
  if (status === "loading") return <PageSkeleton label="Loading your account…" />;
  if (!customerId) return <main className="mx-auto max-w-xl px-4 py-12 text-center"><h1 className="text-3xl font-bold">My Account</h1><p className="my-4">Sign in to view your private account, orders, and saved items.</p><LoadingButton onClick={() => openAuthModal("login")} className="rounded-xl bg-brand-primary px-6 py-3 font-bold">Sign in</LoadingButton></main>;
  const current = ownerId === customerId ? data : null;
  if (!current && !error) return <PageSkeleton label="Loading your account…" />;
  if (!current) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-3xl font-bold">My Account</h1><p className="my-4" role={error ? "alert" : "status"}>{error || "Loading your account…"}</p>{error && <LoadingButton onClick={() => load()} className="rounded-xl bg-brand-primary p-3">Try again</LoadingButton>}</main>;
  // Addresses is no longer an account tab but stays reachable from the overview card and /account/addresses.
  const title = accountDestinations.find(([id]) => id === tab)?.[1] || (tab === "addresses" ? "Addresses" : "Overview");
  const address = editing && editing !== "new" ? editing : null;
  const pages = tab === "orders" ? current.pagination.orderPages : tab === "wants" ? current.pagination.wantPages : 0;
  return <main className={`mx-auto max-w-7xl px-4 sm:px-6 ${["overview", "orders", "wants", "saved", "stores", "profile"].includes(tab) ? "pb-10 pt-4 sm:pt-5" : "py-8"}`}>{tab === "overview" ? <AccountPageHero id="account-heading" eyebrow="Your JORO space" title="My Account" image={{ src: "/images/account/joro-bag-parcels.webp", alt: "JORO shopping bag with delivered parcels", width: 960, height: 480 }}>Welcome back, <span className="break-words">{current.profile.name}</span>. Manage your details and shopping preferences here.</AccountPageHero> : tab === "wants" ? <AccountPageHero id="wants-heading" eyebrow="Your JORO space" title="My Wants" action={<PostWantAction />} image={{ src: "/images/account/joro-bag-parcels.webp", alt: "JORO shopping bag with delivered parcels", width: 960, height: 480 }}>Post what you need and get offers from trusted sellers and service providers.</AccountPageHero> : tab === "orders" ? <AccountPageHero id="orders-heading" eyebrow="Your JORO space" title="Orders" image={{ src: "/images/account/joro-bag-parcels.webp", alt: "JORO shopping bag with delivered parcels", width: 960, height: 480 }}>Track, manage and take action on your orders — all in one place.</AccountPageHero> : tab === "stores" ? null : tab === "profile" ? <AccountPageHero id="settings-heading" eyebrow="Your JORO space" title="Account Settings" image={{ src: "/images/account/settings-hero.webp", alt: "Profile card with a settings gear", width: 680, height: 358 }}>Manage your personal information and keep your JORO account up to date.</AccountPageHero> : tab === "saved" ? <header className="pt-1 sm:pt-2"><p className="text-[13px] font-semibold text-brand-link sm:text-sm">Your JORO space</p><h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-[#005235] sm:text-[30px] lg:text-[32px]">Saved Items</h1><p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-darkText/65 sm:text-[15px]">Unavailable listings stay here until you unsave them. Deleted catalog products are removed automatically.</p></header> : <><p className="text-sm font-bold text-brand-link">Your JORO space</p><h1 className="mt-1 text-3xl font-bold text-[#005235]">{title}</h1></>}{error && <p className="my-4 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{error}</p>}{message && <p className="my-4" role="status">{message}</p>}{loading && <p className="my-3 text-sm" role="status">Refreshing…</p>}<section className={tab === "saved" ? "mt-4 sm:mt-5" : tab === "stores" || tab === "profile" ? "" : "mt-6"}>
    {tab === "overview" && <>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-4">{([
        ["orders", "My Orders", "Track, view and manage your orders.", "/account?tab=orders", ShoppingBag, current.counts.orders],
        ["wants", "My Wants / Requests", "Items you've requested or are interested in.", "/account?tab=wants", ClipboardList, current.counts.wants],
        ["saved", "Saved Items", "Products and services you've saved.", "/account?tab=saved", Heart, current.counts.saved],
        ["following", "Following Stores", "Stores you follow for updates and new arrivals.", "/account?tab=stores", Store, current.counts.following],
        ["unread", "Notifications", "Your latest updates and messages.", "/account/notifications", Bell, current.counts.unread],
        ["addresses", "Saved Addresses", "Manage your delivery addresses.", "/account?tab=addresses", MapPin, current.addresses.length],
      ] as const).map(([key, label, text, href, icon, count]) => <AccountLinkCard key={key} href={href} icon={icon} title={label} count={count} text={text} />)}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:mt-4 lg:grid-cols-3 lg:gap-4">{([
        ["/account?tab=profile", "Personal Information & Settings", "Manage your profile, security, preferences and account settings.", Settings],
        ["/account/help", "Help & Support", "Get help with orders, returns, payments or any other issue.", Headset],
        ["/my-stuff", "My Stuff: purchases & after-sales", "View your deliveries, returns, disputes and after-sales support.", Package],
      ] as const).map(([href, label, text, icon]) => <AccountLinkCard key={href} href={href} icon={icon} title={label} text={text} />)}</div>
      <ExploreBanner />
    </>}
    {tab === "orders" && <><OrderToolbar status={orderStatus} sort={orderSort} /><div className="mt-4 space-y-3 sm:space-y-4">{current.orders.length ? current.orders.map(o => <OrderCard key={o.id} order={o} />) : orderStatus ? <Empty title={`No ${filterLabel(orderStatus).toLowerCase()} orders`}>None of your orders are {filterLabel(orderStatus).toLowerCase()} right now. <Link href={ordersHref(null, orderSort)} className="mt-3 block font-semibold text-brand-link underline">Show all orders</Link></Empty> : <Empty title="No orders yet">Your orders will appear after checkout. <Link href="/products" className="mt-3 block font-semibold text-brand-link underline">Browse products</Link></Empty>}</div></>}
    {tab === "wants" && <><WantToolbar status={wantStatus} sort={wantSort} /><div className="mt-4">{current.wants.length ? <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">{current.wants.map(w => <AccountWantCard key={w.id} want={w} />)}</div> : <WantsEmpty status={wantStatus} sort={wantSort} />}</div></>}
    {tab === "saved" && (current.savedProducts.length ? <div className={gridStyles.grid}>{current.savedProducts.map(p => <ProductCard key={p._id} product={p} />)}</div> : <div className="flex flex-col items-center rounded-2xl border border-[#DFEDE5] bg-gradient-to-b from-[#F7FBF4] to-white px-5 pb-7 pt-4 text-center sm:px-8 sm:pb-9 sm:pt-6 lg:rounded-3xl">
      {/* White-background illustration; multiply blends it into the mint panel and the mask fades its edges. */}
      <Image src="/images/account/saved-empty.webp" alt="" width={720} height={427} unoptimized priority sizes="(min-width: 640px) 360px, 260px" className="h-auto w-[260px] max-w-full mix-blend-multiply [mask-image:radial-gradient(ellipse_at_center,#000_62%,transparent_100%)] sm:w-[360px]" />
      <h2 className="mt-1 text-lg font-semibold text-brand-dark sm:text-xl">Nothing saved yet</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-darkText/60 sm:text-[15px]">Use the heart on a product to save it to your account.</p>
      <Link href="/products" className="mt-5 inline-flex min-h-11 w-full max-w-[260px] items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-brand-dark transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:w-auto"><Search className="h-4 w-4" aria-hidden="true" />Browse products</Link>
    </div>)}
    {tab === "stores" && <FollowingSection stores={current.followedStores} onUnfollow={id => mutate(`/api/stores/${id}/follow`,"DELETE")} />}
    {tab === "addresses" && <><LoadingButton onClick={() => setEditing("new")} className="mb-5 rounded-xl bg-brand-primary px-4 py-3 font-bold">Add address</LoadingButton>{editing && <LoadingForm key={address?.id || "new"} onSubmit={e => saveAddress(e)} className="mb-6 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2"><h2 className="text-xl font-bold sm:col-span-2">{address ? "Edit" : "Add"} delivery address</h2>{([['label','Label',60],['recipientName','Recipient name',200],['phone','Phone',40],['postalCode','Postal code (optional)',30],['city','City',120]] as const).map(([name,label,max]) => <label key={name}>{label}{name==="city"?<PakistanCitySelect name={name} aria-label={label} defaultValue={address?.city||""} required maxLength={max} wrapperClassName="mt-1"/>:<input className={fieldClass} name={name} defaultValue={address?.[name] || ""} required={name !== "postalCode"} maxLength={max} />}</label>)}<label>Street address<textarea className={fieldClass} name="address" rows={3} defaultValue={address?.address || ""} minLength={5} maxLength={2000} required /></label><label className="flex items-center gap-2"><input name="isDefault" type="checkbox" defaultChecked={address?.isDefault} />Default delivery address</label><p className="text-sm text-darkText/65">Your first address becomes the default. At least one remains default while addresses exist.</p><LoadingButton className="rounded-xl bg-brand-primary p-3 font-bold">Save address</LoadingButton><LoadingButton type="button" onClick={() => setEditing(null)}>Cancel edit</LoadingButton></LoadingForm>}{current.addresses.length ? <div className="grid gap-4 md:grid-cols-2">{current.addresses.map(a => <article key={a.id} className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">{a.label}{a.isDefault ? " · Default" : ""}</h2><p className="my-2">{a.recipientName} · {a.phone}</p><p>{a.address}, {a.city} {a.postalCode}</p><div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-brand-link"><LoadingButton onClick={() => setEditing(a)}>Edit</LoadingButton>{!a.isDefault && <LoadingButton onClick={() => mutate(`/api/customer/addresses/${a.id}`,"PATCH",{ isDefault: true })}>Make default</LoadingButton>}<LoadingButton onClick={() => mutate(`/api/customer/addresses/${a.id}`,"DELETE")}>Delete address</LoadingButton></div></article>)}</div> : <Empty title="No addresses saved">Add a delivery address for future checkout.</Empty>}</>}
    {tab === "profile" && <AccountSettingsSection profile={current.profile} onSave={saveProfile} />}
  </section>{pages > 1 && <nav aria-label="Account list pages" className="mt-6 flex flex-wrap items-center gap-4">{page > 1 && <Link href={`${tab === "orders" ? ordersHref(orderStatus, orderSort) : tab === "wants" ? wantsHref(wantStatus, wantSort) : `/account?tab=${tab}`}&page=${page-1}`} className="rounded-xl border p-3">Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={`${tab === "orders" ? ordersHref(orderStatus, orderSort) : tab === "wants" ? wantsHref(wantStatus, wantSort) : `/account?tab=${tab}`}&page=${page+1}`} className="rounded-xl border p-3">Next</Link>}</nav>}</main>;
}

/**
 * "Explore more on JORO": the supplied banner from md up, where its own text stays legible. Its painted
 * Browse products button gets a real link laid exactly over it. Phones get the same message as live text,
 * a real button, and the banner's product artwork.
 */
function ExploreBanner() {
  return <section aria-labelledby="explore-heading" className="mt-5 lg:mt-6">
    <h2 id="explore-heading" className="sr-only">Explore more on JORO</h2>
    <div className="relative hidden overflow-hidden rounded-2xl shadow-[0_6px_22px_rgba(0,61,43,0.10)] md:block lg:rounded-3xl">
      <Image src="/images/account/explore-more-joro.webp" alt="Explore more on JORO. Discover amazing products, services and local businesses." width={1600} height={380} unoptimized priority sizes="(min-width: 1280px) 1232px, 100vw" className="block h-auto w-full" />
      <Link href="/products" aria-label="Browse products" className="absolute left-[3.75%] top-[71%] h-[19.7%] w-[20.6%] rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand-primary" />
    </div>
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B5A35] via-[#11683C] to-[#2E9B45] text-white shadow-[0_8px_28px_rgba(0,61,43,0.14)] md:hidden">
      <div className="px-5 pb-4 pt-5">
        <p className="text-[22px] font-bold leading-tight" aria-hidden="true">Explore more on <span className="text-brand-primary">JORO</span></p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">Discover amazing products, services and local businesses.</p>
        <Link href="/products" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#005235] transition hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">Browse products <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
      <Image src="/images/account/explore-more-joro-products.webp" alt="" width={900} height={315} unoptimized priority sizes="100vw" className="block h-auto w-full" />
    </div>
  </section>;
}
