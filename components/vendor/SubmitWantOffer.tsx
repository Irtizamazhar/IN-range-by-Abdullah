"use client";
import { blockNonDigitKeys, wholeNumber } from "@/lib/whole-number-input";
import { useState, type FormEvent, type ReactNode } from "react";
import toast from "react-hot-toast";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import Link from "@/components/ui/LoadingLink";

type Budget = { min: number | null; max: number | null; flexible: boolean; label: string };
type Errors = Partial<Record<"unitPrice" | "expiresAt" | "message" | "delivery", string>>;
const MESSAGE_MAX = 500;
const DELIVERY_MAX = 300;
const input = "block h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-[15px] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

/** "yyyy-MM-ddTHH:mm" in local time, the format a datetime-local input expects. */
function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Field({ label, hint, htmlFor, error, help, children }: { label: string; hint: string; htmlFor: string; error?: string; help?: ReactNode; children: ReactNode }) {
  return <div className="min-w-0">
    <div className="mb-1.5 flex items-baseline justify-between gap-2"><label htmlFor={htmlFor} className="text-sm font-medium text-neutral-800">{label}</label><span className="text-xs text-neutral-400">{hint}</span></div>
    {children}
    {error ? <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p> : help ? <div className="mt-1 text-xs text-neutral-500">{help}</div> : null}
  </div>;
}

/**
 * Vendor quote on a customer Want. The customer already chose quantity and condition, and the server links
 * the vendor's matching catalog product, so the vendor only sets a unit price and optional warranty/expiry/message.
 */
/**
 * `chooseFrom` is only set when none of the vendor's products matches the Want automatically; the server then
 * links the product priced closest to the quote. An empty list means they have nothing in stock to offer.
 */
export function SubmitWantOffer({ wantId, budget, quantity, wantExpiresAt, chooseFrom }: { wantId: string; budget: Budget; quantity: number; wantExpiresAt: string; chooseFrom?: { id: string; name: string }[] }) {
  const nothingToOffer = !!chooseFrom && chooseFrom.length === 0;
  const [price, setPrice] = useState(""); const [warranty, setWarranty] = useState("");
  const [expiry, setExpiry] = useState(""); const [message, setMessage] = useState(""); const [delivery, setDelivery] = useState("");
  const [sentOfferId, setSentOfferId] = useState("");
  const [errors, setErrors] = useState<Errors>({}); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);

  const now = new Date(); now.setSeconds(0, 0);
  const latest = new Date(Math.min(Date.now() + 30 * 86400000, new Date(wantExpiresAt).getTime()));
  const unit = Number(price);

  function validate(): Errors {
    const next: Errors = {};
    if (!price || !Number.isFinite(unit) || unit < 1) next.unitPrice = "Enter a unit price of at least PKR 1.";
    if (expiry) { const at = new Date(expiry); if (!(at > new Date())) next.expiresAt = "Choose a time in the future."; else if (at > latest) next.expiresAt = `Choose a time before ${latest.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}.`; }
    if (message.length > MESSAGE_MAX) next.message = `Keep the message under ${MESSAGE_MAX} characters.`;
    if (delivery.length > DELIVERY_MAX) next.delivery = `Keep the estimate under ${DELIVERY_MAX} characters.`;
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || done) return;
    const found = validate(); setErrors(found); if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const response = await fetch("/api/vendor/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        wantId, unitPrice: unit, warranty: warranty.trim(), message: message.trim(), delivery: delivery.trim(), ...(expiry ? { expiresAt: new Date(expiry).toISOString() } : {}),
      }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not submit your offer. Please try again.");
      // Repeated clicks are blocked by `busy`/`done`; the server also allows one offer per vendor per Want.
      setDone(true); setSentOfferId(String(result?.offer?.id || "")); toast.success("Your offer has been sent.");
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Could not submit your offer."); }
    finally { setBusy(false); }
  }

  const describe = (id: string, key: keyof Errors) => (errors[key] ? `${id}-error` : undefined);
  return <LoadingForm onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-2xl border border-[#D9E6D0] bg-white p-4 sm:p-5">
    <div><h2 className="text-lg font-bold text-emerald-950">Submit an offer</h2><p className="mt-0.5 text-xs text-neutral-500">For {quantity.toLocaleString("en-PK")} {quantity === 1 ? "unit" : "units"}, as requested by the customer.</p></div>
    <fieldset disabled={busy || done || nothingToOffer} className="flex min-w-0 flex-col gap-4">
      {nothingToOffer && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">You have no active product with at least {quantity.toLocaleString("en-PK")} in stock. Publish one in My Products, then come back to send an offer.</p>}
      <Field label="Unit price PKR" hint="Required" htmlFor="offer-price" error={errors.unitPrice} help={<span>Customer budget: {budget.label}</span>}>
        <input id="offer-price" type="number" inputMode="numeric" min={1} step={1} placeholder="e.g. 800" value={price} onKeyDown={blockNonDigitKeys} onChange={e => setPrice(wholeNumber(e.target.value))} aria-invalid={!!errors.unitPrice} aria-describedby={describe("offer-price", "unitPrice")} className={input} />
      </Field>
      {/* Side by side from sm, but stacked again in the narrow desktop side column. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="Warranty" hint="Optional" htmlFor="offer-warranty">
          <input id="offer-warranty" maxLength={1000} placeholder="e.g. 6 months" value={warranty} onChange={e => setWarranty(e.target.value)} className={input} />
        </Field>
        <Field label="Offer expiry" hint="Optional" htmlFor="offer-expiry" error={errors.expiresAt} help="Defaults to 7 days if left empty.">
          <input id="offer-expiry" type="datetime-local" min={localInputValue(now)} max={localInputValue(latest)} value={expiry} onChange={e => setExpiry(e.target.value)} aria-invalid={!!errors.expiresAt} aria-describedby={describe("offer-expiry", "expiresAt")} className={input} />
        </Field>
      </div>
      <Field label="Delivery / completion estimate" hint="Optional" htmlFor="offer-delivery" error={errors.delivery} help="For example: 2-3 days in Lahore, or completed within a week.">
        <input id="offer-delivery" maxLength={DELIVERY_MAX} placeholder="e.g. 2-3 working days" value={delivery} onChange={e => setDelivery(e.target.value)} aria-invalid={!!errors.delivery} aria-describedby={describe("offer-delivery", "delivery")} className={input} />
      </Field>
      <Field label="Note to the customer" hint={`${message.length} / ${MESSAGE_MAX}`} htmlFor="offer-message" error={errors.message}>
        <textarea id="offer-message" rows={4} maxLength={MESSAGE_MAX} placeholder="What you're offering, scope, and anything the customer should know" value={message} onChange={e => setMessage(e.target.value)} className={`${input} h-auto py-2.5`} />
      </Field>
    </fieldset>
    <LoadingButton type="submit" loading={busy} loadingLabel="Submitting…" disabled={done || nothingToOffer} className="h-11 w-full rounded-lg bg-brand-primary font-bold text-brand-dark transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60">{done ? "Offered" : "Send Offer"}</LoadingButton>
    {done && <div role="status" className="rounded-lg bg-[#F3F9EC] px-3 py-3 text-center text-sm text-[#005235]"><p className="font-bold">Your offer has been sent.</p><p className="mt-1 text-xs text-neutral-600">The customer sees it privately. Your button now shows “Offered”.</p><Link href={sentOfferId ? `/vendor/dashboard/offers#${sentOfferId}` : "/vendor/dashboard/offers"} className="mt-2 inline-block font-bold underline">View / Edit Offer</Link></div>}
  </LoadingForm>;
}
