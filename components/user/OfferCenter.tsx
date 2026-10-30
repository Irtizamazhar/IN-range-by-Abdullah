"use client";
import { wholeNumberInputProps } from "@/lib/whole-number-input";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import toast from "react-hot-toast";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import Link from "@/components/ui/LoadingLink";
import { useCallback, useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useCart } from "@/context/CartContext";
import { NeedHelpButton } from "@/components/support/NeedHelpButton";
import { offerStatusLabel } from "@/lib/want-social";
import Image from "next/image";
import { ArrowRight, CalendarDays, ChevronDown, Clock3, History, MapPin, Package, ShieldCheck, Store, Truck, Wrench } from "lucide-react";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
type Revision = { id: string; productId: string | null; image?: string; price: string; quantity: number; shipping: string; delivery: string; condition: string; warranty: string; message: string; expiresAt: string; revisionNumber: number; initiator: string; createdAt?: string };
type Offer = { id: string; status: string; version?: number; want: { id: string; title: string; city: string }; vendor?: { shopName: string; status: string; storeSlug: string | null }; revisions: Revision[] };
function isExpiredOffer(o: Offer) { const latest = o.revisions[0]; return !!latest && ["SUBMITTED", "COUNTERED"].includes(o.status) && new Date(latest.expiresAt).getTime() <= Date.now(); }
function displayStatus(o: Offer) { return offerStatusLabel({ status: o.status, version: o.version, latestExpiresAt: o.revisions[0]?.expiresAt }); }
export function OfferCenter({ vendor = false }: { vendor?: boolean }) {
  return vendor ? <OfferCenterBody vendor isCustomer openAuthModal={() => {}} addItem={() => {}} /> : <CustomerOfferCenter />;
}
function CustomerOfferCenter() {
  const { isCustomer, openAuthModal } = useCustomerAuth(); const { addItem } = useCart();
  return <OfferCenterBody isCustomer={isCustomer} openAuthModal={openAuthModal} addItem={addItem} />;
}
function OfferCenterBody({ vendor = false, isCustomer, openAuthModal, addItem }: { vendor?: boolean; isCustomer: boolean; openAuthModal: (tab: "login") => void; addItem: ReturnType<typeof useCart>["addItem"] }) {
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]); const [message, setMessage] = useState("Loading…"); const load = useCallback(async () => { setLoading(true); try { const r = await fetch(vendor ? "/api/vendor/offers" : "/api/account/offers"); const d = await r.json(); if (!r.ok) throw new Error(d.error); setOffers(d.offers); setLoadError(false); setMessage(d.offers.length ? "" : "No offers yet."); } catch(e) { setLoadError(true); setMessage(e instanceof Error ? e.message : "Could not load offers."); } finally { setLoading(false); } }, [vendor]);
  useEffect(() => { if (vendor || isCustomer) void load(); }, [vendor, isCustomer, load]);
  // Notification links point at #offerId; offers load after the page, so scroll once they render.
  const [focused, setFocused] = useState("");
  useEffect(() => { const id = decodeURIComponent(window.location.hash.slice(1)); if (!id || !offers.some(o => o.id === id)) return; setFocused(id); document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [offers]);
  async function action(offer: Offer, action: string, fields?: FormData) { try {
    const latest = offer.revisions[0]; const terms = fields ? { productId: latest.productId, price: Number(fields.get("price")), quantity: latest.quantity, shipping: Number(latest.shipping), delivery: latest.delivery, condition: latest.condition, warranty: String(fields.get("warranty")), message: String(fields.get("message")), expiresAt: new Date(String(fields.get("expiry"))).toISOString() } : {};
    const r = await fetch(`/api/offers/${offer.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, revisionId: latest.id, idempotencyKey: crypto.randomUUID(), ...terms }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error);
    if (d.quote) { const q = await fetch(`/api/account/quotes/${d.quote.id}`); const data = await q.json(); if (!q.ok) throw new Error(data.error); const rev = data.quote.revision;
      addItem({ productId: rev.productId || `quote:${d.quote.id}`, name: data.quote.want.requestType === "SERVICE" ? data.quote.want.title : rev.product?.name || data.quote.want.title, price: Number(rev.price), quantity: rev.quantity, maxStock: rev.quantity, image: "", quoteId: d.quote.id, quoteShipping: Number(rev.shipping) });
      await load();
      setMessage("Accepted quote added to your cart. Checkout this quoted item on its own; remove other cart items first. Acceptance is not payment.");
    } else { await load(); toast.success(action === "withdraw" ? "Offer withdrawn." : action === "reject" ? "Offer rejected." : "Offer terms sent."); }
  } catch(e) { setMessage(e instanceof Error ? e.message : "Could not update offer."); } }
  if (!vendor && !isCustomer) return <LoadingButton onClick={() => openAuthModal("login")} className="rounded-xl bg-brand-primary p-3">Sign in to view offers</LoadingButton>;
  return <>
    {loading && !offers.length && !loadError && <PageSkeleton label="Loading offers…" variant="cards" rows={3} />}
    {loadError && <div role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800"><p>{message || "Could not load offers."}</p><LoadingButton onClick={load} className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-700">Try again</LoadingButton></div>}
    {!loadError && message && !(offers.length === 0 && !loading) && <p className="mt-4 rounded-xl bg-brand-soft/60 px-4 py-3 text-sm text-brand-dark" role="status">{message}</p>}
    {!loading && !loadError && offers.length === 0 && <div role="status" className="mt-4 rounded-2xl border border-dashed border-[#CFE3D4] bg-white px-5 py-8 text-center"><h2 className="text-base font-semibold text-[#005235] sm:text-[17px]">No offers yet</h2><p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-darkText/60 sm:text-sm">{vendor ? "Offers you send on customer Wants will appear here." : "When sellers make offers on your Wants, they will appear here."}</p><Link href={vendor ? "/vendor/dashboard/demand" : "/wants?tab=mine"} className="mt-3 inline-block text-sm font-semibold text-brand-link underline">{vendor ? "Browse customer demand" : "View my Wants"}</Link></div>}
    <div className="mt-4 space-y-4">{offers.map(o => <OfferCard key={o.id} offer={o} vendor={vendor} focused={focused === o.id} onAction={action} />)}</div>
  </>;
}

const STATUS_BADGE: Record<string, string> = { ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200", REJECTED: "bg-red-50 text-red-700 ring-red-200", WITHDRAWN: "bg-gray-100 text-gray-700 ring-gray-200", COUNTERED: "bg-sky-50 text-sky-700 ring-sky-200", SUBMITTED: "bg-amber-50 text-amber-800 ring-amber-200" };
const when = (value?: string) => { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-PK") : "—"; };
const money = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;

function Detail({ icon: Icon, label, value }: { icon: typeof Wrench; label: string; value?: string }) {
  return <div className="flex min-w-0 items-start gap-2.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-darkText/45" aria-hidden="true" /><div className="min-w-0"><dt className="text-xs text-darkText/55">{label}</dt><dd className="break-words text-[13px] font-medium text-brand-dark sm:text-sm">{value || "—"}</dd></div></div>;
}

/** One offer thread: seller, status, the latest terms (price, details, message), its actions and the revision history. */
function OfferCard({ offer: o, vendor, focused, onAction }: { offer: Offer; vendor: boolean; focused: boolean; onAction: (offer: Offer, action: string, fields?: FormData) => Promise<void> }) {
  const r = o.revisions[0]; if (!r) return null;
  const total = Number(r.price) * r.quantity + Number(r.shipping);
  const shop = o.vendor?.status === "approved" && o.vendor.storeSlug ? o.vendor : null;
  const open = ["SUBMITTED", "COUNTERED"].includes(o.status);
  const help = (className: string) => <NeedHelpButton role={vendor ? "vendor" : "customer"} resourceType="WANT_OFFER" resourceId={o.id} className={className} />;
  const price = <div className="min-w-0"><p className="break-words text-xl font-bold tabular-nums leading-tight text-[#005235] sm:text-2xl">{money(total)}</p><p className="mt-0.5 text-[13px] tabular-nums text-darkText/60 sm:text-sm">{r.quantity} × {money(Number(r.price))}{Number(r.shipping) > 0 ? ` + ${money(Number(r.shipping))} delivery` : ""}</p><p className="sr-only">full payable</p></div>;
  const thumb = <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E3ECE6] bg-[#F7FAF5] sm:h-20 sm:w-20">{r.image ? <Image src={r.image} alt="" fill sizes="80px" className="object-contain p-1" unoptimized={shouldUnoptimizeImageSrc(r.image)} /> : <Package className="h-6 w-6 text-darkText/30" aria-hidden="true" />}</span>;
  return <article id={o.id} aria-labelledby={`offer-${o.id}`} className={`scroll-mt-24 rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(0,61,43,0.04),0_6px_18px_rgba(0,61,43,0.04)] sm:p-5 ${focused ? "border-[#005235] ring-2 ring-[#B5E637]" : "border-[#E3ECE6]"}`}>
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-8">
      <div className="min-w-0">
        <h2 id={`offer-${o.id}`} className="break-words text-base font-semibold leading-snug text-brand-dark sm:text-lg"><Link href={`/wants/${o.want.id}`} className="hover:text-brand-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link">{o.want.title}</Link></h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-darkText/70 sm:text-sm">
          {o.vendor?.shopName && <span className="inline-flex min-w-0 items-center gap-1.5"><Store className="h-4 w-4 shrink-0 text-darkText/45" aria-hidden="true" /><span className="break-words">{o.vendor.shopName}</span></span>}
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_BADGE[o.status] || "bg-gray-100 text-gray-700 ring-gray-200"}`}><span className="sr-only">Status: </span>{displayStatus(o)}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-darkText/45" aria-hidden="true" /><span className="break-words">{o.want.city}</span></span>
        </p>
        {/* Phones and tablets: the price sits in its own light-green panel with the product image. */}
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F2F8EC] p-3 lg:hidden">{thumb}<div className="min-w-0 flex-1 text-right">{price}</div></div>
        <div className="mt-4 flex gap-4">
          <span className="hidden lg:inline-flex">{thumb}</span>
          <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-3 min-[360px]:grid-cols-2">
            <div className="space-y-3"><Detail icon={Wrench} label="Condition" value={r.condition} /><Detail icon={Truck} label="Delivery / completion" value={r.delivery} /><Detail icon={ShieldCheck} label="Warranty" value={r.warranty} /></div>
            <div className="space-y-3 min-[360px]:border-l min-[360px]:border-[#EEF3EF] min-[360px]:pl-6"><Detail icon={CalendarDays} label="Offer date" value={r.createdAt ? when(r.createdAt) : undefined} /><Detail icon={Clock3} label="Expires" value={when(r.expiresAt)} /></div>
          </dl>
        </div>
        {r.message && <div className="mt-4 border-t border-[#EEF3EF] pt-3"><p className="text-xs text-darkText/55">Description</p><p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-brand-dark sm:text-sm">{r.message}</p></div>}
      </div>
      <div className="mt-4 hidden flex-col items-end gap-4 lg:mt-0 lg:flex">{help("rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-primary")}<div className="text-right">{price}</div></div>
    </div>

    {open && (isExpiredOffer(o) ? <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-[13px] font-medium text-gray-600">This offer has expired and can no longer be changed.</p> : <div className="mt-4 border-t border-[#EEF3EF] pt-4">
      <div className="flex flex-wrap gap-2">{!vendor && r.initiator === "VENDOR" && <LoadingButton onClick={() => onAction(o, "accept")} className="min-h-11 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-brand-dark hover:bg-brand-hover sm:min-h-10">Accept & add to cart</LoadingButton>}<LoadingButton onClick={() => onAction(o, vendor ? "withdraw" : "reject")} className="min-h-11 rounded-xl border border-[#DFEDE5] bg-white px-4 text-sm font-semibold text-brand-dark hover:bg-brand-soft sm:min-h-10">{vendor ? "Withdraw" : "Reject"}</LoadingButton></div>
      <details className="group mt-3 rounded-xl border border-[#E3ECE6]"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-brand-dark [&::-webkit-details-marker]:hidden">{vendor ? "Revise offer" : "Counter offer"}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary><LoadingForm className="joro-form grid gap-3 px-4 pb-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); return onAction(o, vendor ? "revise" : "counter", new FormData(e.currentTarget)); }}><label>Unit price PKR<input type="number" name="price" defaultValue={Math.round(Number(r.price))} min={1} required {...wholeNumberInputProps} /></label><label>Warranty<input name="warranty" defaultValue={r.warranty} /></label><label>Expiry<input name="expiry" type="datetime-local" required /></label><label>Message<textarea name="message" maxLength={500} /></label><LoadingButton className="rounded-xl bg-brand-primary p-3 font-semibold">Send terms</LoadingButton></LoadingForm></details>
    </div>)}

    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start">
      <details className="group min-w-0 flex-1 rounded-xl border border-[#E3ECE6]"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[13px] font-medium text-brand-dark sm:text-sm [&::-webkit-details-marker]:hidden"><span className="inline-flex items-center gap-2"><History className="h-4 w-4 text-darkText/55" aria-hidden="true" />Revision history</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary><ol className="space-y-2 px-4 pb-3">{o.revisions.map(v => <li className="break-words text-[13px] text-darkText/75" key={v.id}>{[`V${v.revisionNumber}`, v.initiator, `PKR ${v.price} × ${v.quantity}${Number(v.shipping) > 0 ? ` + ${v.shipping} shipping` : ""}`, v.delivery, v.warranty, v.message].filter(Boolean).join(" · ")}</li>)}</ol></details>
      <div className="flex flex-col gap-3 lg:min-h-11 lg:justify-center">
        {shop && <Link className="inline-flex items-center gap-1.5 self-end text-sm font-semibold text-brand-link hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link" href={`/stores/${encodeURIComponent(shop.storeSlug!)}`}>View {shop.shopName} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
        <div className="lg:hidden">{help("w-full min-h-11 justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-brand-dark")}</div>
      </div>
    </div>
  </article>;
}
