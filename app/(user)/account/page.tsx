"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Heart, MapPin, Package, Plus, Store, UserRound, X } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/user/ProductCard";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import { PAKISTANI_CITIES } from "@/lib/pakistani-cities";

type AccountData = {
  profile: { name: string; email: string; phone: string; createdAt: string };
  orders: Array<{ id: string; orderNumber: string; orderStatus: string; paymentStatus: string; totalAmount: number; createdAt: string }>;
  addresses: Array<{ id: string; label: string; recipientName: string; phone: string; address: string; city: string; postalCode: string | null; isDefault: boolean }>;
  savedProducts: ProductCardData[];
  followedStores: Array<{ id: string; shopName: string; primaryCategory: string; city: string; _count: { followers: number; products: number } }>;
  wants: Array<{ id: string; title: string; status: string; offerCount: number; city: string; createdAt: string }>;
};

const tabs = [
  ["orders", "Orders", Package],
  ["saved", "Saved", Heart],
  ["addresses", "Addresses", MapPin],
  ["wants", "My Wants", Plus],
  ["stores", "Following", Store],
  ["profile", "Profile", UserRound],
] as const;

export default function AccountPage() {
  const { openAuthModal, openProfileModal } = useCustomerAuth();
  const [data, setData] = useState<AccountData | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("orders");
  const [addressOpen, setAddressOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customer/account");
      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!response.ok) throw new Error("Could not load account");
      setData((await response.json()) as AccountData);
      setUnauthorized(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (tabs.some(([id]) => id === requested)) setTab(requested as typeof tab);
    void load();
  }, [load]);

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/customer/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: String(form.get("label") || "Home"),
        recipientName: String(form.get("recipientName") || ""),
        phone: String(form.get("phone") || ""),
        address: String(form.get("address") || ""),
        city: String(form.get("city") || ""),
        postalCode: String(form.get("postalCode") || "") || null,
        isDefault: form.get("isDefault") === "on",
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return toast.error(result.error || "Could not save address");
    toast.success("Address saved");
    setAddressOpen(false);
    await load();
  }

  async function removeAddress(id: string) {
    const response = await fetch(`/api/customer/addresses/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Could not remove address");
    setData((current) => current ? { ...current, addresses: current.addresses.filter((item) => item.id !== id) } : current);
  }

  if (loading && !data) {
    return <main className="mx-auto max-w-7xl px-4 py-20 text-center text-darkText/55">Loading your account…</main>;
  }
  if (unauthorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <section className="rounded-2xl border border-borderGray bg-white p-8 shadow-card">
          <h1 className="text-2xl font-black text-brand-dark">Sign in to view your account</h1>
          <p className="mt-2 text-sm text-darkText/60">Orders, saved products, addresses, followed stores, and Wants are private.</p>
          <button onClick={() => openAuthModal("login")} className="mt-6 w-full rounded-xl bg-brand-primary px-4 py-3 font-black text-brand-dark">Sign in</button>
        </section>
      </main>
    );
  }
  if (!data) return null;

  const empty = (title: string, text: string) => (
    <div className="rounded-2xl border border-dashed border-borderGray bg-white p-10 text-center">
      <h3 className="font-bold text-brand-dark">{title}</h3><p className="mt-1 text-sm text-darkText/55">{text}</p>
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-black uppercase tracking-wider text-brand-link">Customer account</p><h1 className="text-3xl font-black text-brand-dark">Hello, {data.profile.name}</h1></div>
        <div className="flex flex-wrap gap-3">
          <Link href="/my-stuff" className="rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-black text-brand-link">My Stuff & Returns</Link>
          <Link href="/products" className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-black text-brand-dark">Continue shopping</Link>
        </div>
      </div>
      <nav className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-brand-link">
        <Link href="/account/offers" className="rounded-xl border border-borderGray bg-white px-3 py-2 hover:bg-brand-soft">Received Offers</Link>
        <Link href="/account/together" className="rounded-xl border border-borderGray bg-white px-3 py-2 hover:bg-brand-soft">Family rooms</Link>
        <Link href="/account/services" className="rounded-xl border border-borderGray bg-white px-3 py-2 hover:bg-brand-soft">Services</Link>
        <Link href="/account/notifications" className="rounded-xl border border-borderGray bg-white px-3 py-2 hover:bg-brand-soft">Notifications</Link>
      </nav>
      <div className="mt-7 flex gap-2 overflow-x-auto border-b border-borderGray pb-3">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === id ? "bg-brand-primary text-brand-dark" : "bg-white text-darkText/65 hover:bg-brand-soft"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <section className="mt-6">
        {tab === "orders" && (data.orders.length ? (
          <div className="space-y-3">{data.orders.map((order) => <Link key={order.id} href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`} className="flex flex-col gap-3 rounded-2xl border border-borderGray bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-brand-dark">{order.orderNumber}</p><p className="mt-1 text-xs text-darkText/50">{new Date(order.createdAt).toLocaleString("en-PK")}</p></div><div className="flex items-center gap-4"><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{order.orderStatus}</span><span className="font-black text-brand-dark">{formatPKR(order.totalAmount)}</span></div></Link>)}</div>
        ) : empty("No orders yet", "Your completed checkouts will appear here."))}

        {tab === "saved" && (data.savedProducts.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">{data.savedProducts.map((product) => <ProductCard key={product._id} product={product} />)}</div> : empty("Nothing saved", "Use the heart on a product card to keep it here."))}

        {tab === "addresses" && <><div className="mb-4 flex justify-end"><button onClick={() => setAddressOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-dark"><Plus className="h-4 w-4" />Add address</button></div>{data.addresses.length ? <div className="grid gap-4 md:grid-cols-2">{data.addresses.map((address) => <article key={address.id} className="relative rounded-2xl border border-borderGray bg-white p-5 shadow-card"><button aria-label="Remove address" onClick={() => void removeAddress(address.id)} className="absolute right-3 top-3 rounded-lg p-1.5 text-darkText/35 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button><div className="flex items-center gap-2"><h3 className="font-black text-brand-dark">{address.label}</h3>{address.isDefault && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-link">Default</span>}</div><p className="mt-3 text-sm font-semibold text-darkText">{address.recipientName} · {address.phone}</p><p className="mt-1 pr-7 text-sm leading-5 text-darkText/60">{address.address}, {address.city}{address.postalCode ? ` ${address.postalCode}` : ""}</p></article>)}</div> : empty("No saved addresses", "Save delivery details for faster checkout.")}</>}

        {tab === "wants" && <><div className="mb-4 flex justify-end"><Link href="/wants/new" className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-dark">Post a Want</Link></div>{data.wants.length ? <div className="space-y-3">{data.wants.map((want) => <Link key={want.id} href={`/wants/${want.id}`} className="flex items-center justify-between rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div><h3 className="font-black text-brand-dark">{want.title}</h3><p className="mt-1 text-xs text-darkText/50">{want.city} · {want.offerCount} offers</p></div><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{want.status}</span></Link>)}</div> : empty("No Wants yet", "Post a need and approved sellers can respond after moderation.")}</>}

        {tab === "stores" && (data.followedStores.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.followedStores.map((store) => <Link key={store.id} href={`/stores/${store.id}`} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><h3 className="font-black text-brand-dark">{store.shopName}</h3><p className="mt-1 text-sm font-semibold text-brand-link">{store.primaryCategory}</p><p className="mt-3 text-xs text-darkText/50">{store.city} · {store._count.products} products · {store._count.followers} followers</p></Link>)}</div> : empty("No followed stores", "Follow an approved store to keep it here."))}

        {tab === "profile" && <div className="max-w-xl rounded-2xl border border-borderGray bg-white p-6 shadow-card"><h2 className="text-xl font-black text-brand-dark">Profile details</h2><dl className="mt-5 space-y-3 text-sm"><div><dt className="font-bold text-darkText/45">Name</dt><dd className="text-darkText">{data.profile.name}</dd></div><div><dt className="font-bold text-darkText/45">Email</dt><dd className="text-darkText">{data.profile.email}</dd></div><div><dt className="font-bold text-darkText/45">Phone</dt><dd className="text-darkText">{data.profile.phone || "Not added"}</dd></div></dl><button onClick={openProfileModal} className="mt-6 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-dark">Edit profile</button></div>}
      </section>

      {addressOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><form onSubmit={addAddress} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-brand-dark">Add delivery address</h2><button type="button" onClick={() => setAddressOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{[["label","Label"],["recipientName","Recipient name"],["phone","Phone"],["postalCode","Postal code (optional)"]].map(([name,label]) => <label key={name} className="text-sm font-bold text-darkText">{label}<input required={name !== "postalCode"} name={name} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5" /></label>)}<label className="text-sm font-bold text-darkText sm:col-span-2">Address<textarea required minLength={5} name="address" rows={3} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5" /></label><label className="text-sm font-bold text-darkText">City<select required name="city" className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5"><option value="">Select city</option>{PAKISTANI_CITIES.map((city) => <option key={city}>{city}</option>)}</select></label><label className="flex items-end gap-2 pb-3 text-sm font-bold text-darkText"><input type="checkbox" name="isDefault" />Make default</label></div><button className="mt-5 w-full rounded-xl bg-brand-primary px-4 py-3 font-black text-brand-dark">Save address</button></form></div>}
    </main>
  );
}
