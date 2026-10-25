"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import toast from "react-hot-toast";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { useCallback, useEffect, useState } from "react";
import { NeedHelpButton } from "@/components/support/NeedHelpButton";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { Boxes, CalendarClock, CalendarDays, ChevronDown, ClipboardList, CreditCard, FileText, Home, MapPin, Save, ShieldCheck, Tag, Wrench } from "lucide-react";
type Job = { id: string; standalone?: boolean; status: string; scheduledAt: string | null; refundStatus: string; snapshot: { quantity?: number; address?: string; description?: string; delivery?: string; name: string; warranty: string; total: string; city: string; cancellationTerms: string }; order: { orderNumber: string; paymentStatus?: string }; events: { id: string; status: string; note: string }[] };
/** The status changes each role may request on a booking; the API enforces the transitions again. */
function bookingActions(role: "customer" | "vendor" | "admin", j: Job) { return role === "customer" ? ["SCHEDULE_REQUIRED"] : role === "vendor" ? ["CONFIRMED","SCHEDULE_REQUIRED","SCHEDULED","IN_PROGRESS",...(j.standalone ? ["COMPLETED"] : [])] : ["CONFIRMED","SCHEDULE_REQUIRED","SCHEDULED","IN_PROGRESS","COMPLETED","CANCELLED","FAILED"]; }
export function ServiceBookings({ role = "customer" }: { role?: "customer" | "vendor" | "admin" }) {
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]); const [message, setMessage] = useState("Loading…"); const load = useCallback(async () => { setLoading(true); try { const r = await fetch(`/api/services/bookings?role=${role}`); const d = await r.json(); if (!r.ok) throw new Error(d.error); setJobs(d.bookings); setLoadError(false); setMessage(d.bookings.length ? "" : "No service bookings yet."); } catch(e) { setLoadError(true); setMessage(e instanceof Error ? e.message : "Could not load bookings."); } finally { setLoading(false); } }, [role]);
  useEffect(() => { void load(); }, [load]);
  async function change(e: React.FormEvent<HTMLFormElement>, id: string) { e.preventDefault(); const f = new FormData(e.currentTarget); try { const r = await fetch("/api/services/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, role, status: f.get("status"), note: f.get("note"), ...(f.get("date") ? { scheduledAt: new Date(String(f.get("date"))).toISOString() } : {}) }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await load(); toast.success("Service booking updated."); } catch(e) { setMessage(e instanceof Error ? e.message : "Could not update service."); } }
  return <>{loading && !jobs.length && !loadError && <PageSkeleton label="Loading service bookings…" variant="cards" rows={3} />}{loadError && <LoadingButton onClick={load} className="rounded-xl border p-3">Try again</LoadingButton>}{role === "customer" && !loading && !loadError && !jobs.length ? <CustomerServicesEmpty /> : role === "customer" && jobs.length && !message ? <p className="mt-4 text-[13px] font-medium text-darkText/60 sm:mt-5 sm:text-sm" role="status">{jobs.length} service {jobs.length === 1 ? "booking" : "bookings"}</p> : <p className="my-4" role="status">{message}</p>}{jobs.map(j => role === "customer" ? <CustomerBookingCard key={j.id} job={j} onSubmit={e => change(e, j.id)} /> : <article className="mb-4 rounded-2xl border bg-white p-5" key={j.id}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{j.snapshot.name}</h2>{role !== "admin" && <NeedHelpButton role={role} resourceType="SERVICE_BOOKING" resourceId={j.id} />}</div><p className="my-2">Order {j.order.orderNumber} · {j.status} · PKR {j.snapshot.total}</p><p>Payment: {j.order.paymentStatus || "pending"}. {j.standalone && "Completion does not confirm payment. Admin records receipt separately in order management."}</p><p>{j.snapshot.city} · {j.scheduledAt ? new Date(j.scheduledAt).toLocaleString() : "Scheduling required"}</p>{j.standalone && <div className="my-3 space-y-1 text-sm"><p>Agreed quantity: {j.snapshot.quantity}</p><p>Service location: {j.snapshot.address}</p>{j.snapshot.description && <p className="whitespace-pre-wrap">Scope: {j.snapshot.description}</p>}{j.snapshot.delivery && <p>Agreed estimate: {j.snapshot.delivery}</p>}</div>}<p className="my-2">Warranty: {j.snapshot.warranty || "Not specified"}</p><details><summary>Cancellation terms & history</summary><p>{j.snapshot.cancellationTerms}</p>{j.events.map(ev => <p key={ev.id} className="my-2 text-sm">{ev.status} · {ev.note}</p>)}</details>{j.refundStatus !== "NONE" && <p className="mt-3 text-amber-800">Refund requires admin review. No refund has been confirmed here.</p>}{!["COMPLETED","CANCELLED","FAILED"].includes(j.status) && <LoadingForm onSubmit={e => change(e,j.id)} className="joro-form mt-4 grid gap-3 sm:grid-cols-2"><label>Action<select name="status">{bookingActions(role, j).map(s => <option key={s}>{s}</option>)}</select></label><label>Requested / scheduled date<input type="datetime-local" name="date" /></label><label>Note / evidence<input name="note" minLength={3} maxLength={2000} required /></label><LoadingButton className="self-end rounded-xl bg-brand-primary p-3">Save</LoadingButton></LoadingForm>}</article>)}</>;
}

/** Customer empty state: shown only after bookings loaded successfully and there are none. */
function CustomerServicesEmpty() {
  return <div role="status" className="mt-4 flex flex-col items-center rounded-2xl border border-[#DFEDE5] bg-gradient-to-b from-[#F4FAEF] to-[#FAFDF7] px-5 pb-7 pt-4 text-center sm:mt-5 sm:px-8 sm:pb-9 sm:pt-6 lg:rounded-3xl">
    {/* White-background illustration; multiply blends it into the mint panel and the mask fades its edges. */}
    <Image src="/images/account/services-empty.webp" alt="" width={620} height={392} priority sizes="(min-width: 640px) 360px, 260px" className="h-auto w-[260px] max-w-full mix-blend-multiply [mask-image:radial-gradient(ellipse_at_center,#000_62%,transparent_100%)] sm:w-[360px]" />
    <h2 className="mt-1 text-lg font-semibold text-brand-dark sm:text-xl">No service bookings yet</h2>
    <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-darkText/60 sm:text-[15px]">Book services, installations, repairs and more, and manage them all in one place.</p>
    <Link href="/services" className="mt-5 inline-flex min-h-11 w-full max-w-[280px] items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-brand-dark transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:w-auto"><CalendarDays className="h-4 w-4" aria-hidden="true" />Explore services</Link>
  </div>;
}

const BOOKING_STATUS: Record<string, string> = { PENDING: "bg-amber-50 text-amber-800 ring-amber-200", SCHEDULE_REQUIRED: "bg-amber-50 text-amber-800 ring-amber-200", CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200", SCHEDULED: "bg-emerald-50 text-emerald-700 ring-emerald-200", IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-200", COMPLETED: "bg-teal-50 text-teal-700 ring-teal-200", CANCELLED: "bg-red-50 text-red-700 ring-red-200", FAILED: "bg-red-50 text-red-700 ring-red-200" };
const PAYMENT_TONE: Record<string, string> = { pending: "text-amber-700", submitted: "text-sky-700", received: "text-emerald-700", failed: "text-red-700" };
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
const shown = (value: unknown) => value === undefined || value === null || value === "" ? "—" : String(value);
const field = "mt-1 block w-full min-w-0 rounded-xl border border-[#DFEAE3] bg-white px-3.5 text-sm text-brand-dark focus:border-brand-link focus:outline-none focus:ring-2 focus:ring-brand-link/20";

function Detail({ icon: Icon, label: name, children, wide = false }: { icon: typeof MapPin; label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={`flex min-w-0 gap-2.5 ${wide ? "sm:col-span-2" : ""}`}>
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-darkText/45" aria-hidden="true" />
    <div className="min-w-0"><dt className="text-xs text-darkText/55">{name}</dt><dd className="break-words text-[13px] font-medium text-brand-dark sm:text-sm">{children}</dd></div>
  </div>;
}

/**
 * Customer view of one service booking: title, reference, booking and payment status, and the amount; the booking
 * details, scope and cancellation history; and the existing action/date/note form (beside the details from lg).
 */
function CustomerBookingCard({ job: j, onSubmit }: { job: Job; onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> }) {
  const payment = j.order.paymentStatus || "pending";
  const scheduled = j.scheduledAt && !Number.isNaN(new Date(j.scheduledAt).getTime()) ? new Date(j.scheduledAt).toLocaleString() : null;
  const open = !["COMPLETED", "CANCELLED", "FAILED"].includes(j.status);
  return <article aria-labelledby={`booking-${j.id}`} className="mt-3 rounded-2xl border border-[#DFEAE3] bg-white p-4 shadow-[0_1px_2px_rgba(0,61,43,0.04),0_6px_18px_rgba(0,61,43,0.04)] sm:p-5">
    <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#005235] sm:h-12 sm:w-12"><Wrench className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} aria-hidden="true" /></span>
      {/* The minimum width makes the price and Need Help wrap below on phones instead of squeezing the title. */}
      <div className="min-w-[11rem] flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h2 id={`booking-${j.id}`} className="min-w-0 break-words text-base font-bold leading-snug text-brand-dark sm:text-lg">{j.snapshot.name}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${BOOKING_STATUS[j.status] || "bg-gray-100 text-gray-700 ring-gray-200"}`}><span className="sr-only">Booking status: </span>{label(j.status)}</span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-darkText/60 sm:text-sm">
          <span className="break-all">Booking #{j.order.orderNumber}</span>
          <span className={`inline-flex items-center gap-1 rounded-full bg-[#F4F8F2] px-2 py-0.5 text-xs font-medium ${PAYMENT_TONE[payment] || "text-brand-dark"}`}><CreditCard className="h-3.5 w-3.5" aria-hidden="true" />Payment: {label(payment)}</span>
        </p>
      </div>
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
        <p className="text-xl font-bold tabular-nums leading-tight text-[#005235] sm:text-2xl">PKR {Number.isFinite(Number(j.snapshot.total)) ? Number(j.snapshot.total).toLocaleString("en-PK") : shown(j.snapshot.total)}</p>
        <NeedHelpButton role="customer" resourceType="SERVICE_BOOKING" resourceId={j.id} className="rounded-full px-4 text-[13px] font-semibold text-brand-dark sm:text-sm" />
      </div>
    </header>

    <div className={`mt-4 grid gap-4 border-t border-[#EEF3EF] pt-4 ${open ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6" : ""}`}>
      <div className="min-w-0 space-y-3">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail icon={MapPin} label="City">{shown(j.snapshot.city)}</Detail>
          <Detail icon={CalendarClock} label="Scheduled date">{scheduled || "Scheduling required"}</Detail>
          {j.standalone && <Detail icon={Home} label="Service location" wide>{shown(j.snapshot.address)}</Detail>}
          {j.standalone && <Detail icon={Boxes} label="Agreed quantity">{shown(j.snapshot.quantity)}</Detail>}
          {j.standalone && j.snapshot.delivery && <Detail icon={Tag} label="Agreed estimate">{j.snapshot.delivery}</Detail>}
          <Detail icon={ShieldCheck} label="Warranty">{j.snapshot.warranty || "Not specified"}</Detail>
          <Detail icon={CreditCard} label="Payment status"><span className={PAYMENT_TONE[payment] || ""}>{label(payment)}</span>{j.standalone && <span className="mt-0.5 block text-xs font-normal text-darkText/60">Completion does not confirm payment. Admin records receipt separately in order management.</span>}</Detail>
        </dl>
        {j.standalone && j.snapshot.description && <div className="rounded-xl bg-[#F1F9F1] px-3.5 py-3"><p className="flex items-center gap-2 text-xs font-semibold text-brand-dark"><ClipboardList className="h-4 w-4 text-darkText/50" aria-hidden="true" />Scope</p><p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-darkText/75 sm:text-sm">{j.snapshot.description}</p></div>}
        <details className="group rounded-xl border border-[#DFEAE3] bg-[#F7FBF6]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-4 text-[13px] font-semibold text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link sm:text-sm [&::-webkit-details-marker]:hidden"><FileText className="h-4 w-4 text-darkText/55" aria-hidden="true" />Cancellation terms &amp; history<ChevronDown className="ml-auto h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary>
          <div className="space-y-2 px-4 pb-3 text-[13px] text-darkText/75">
            <p className="whitespace-pre-wrap break-words">{shown(j.snapshot.cancellationTerms)}</p>
            {j.events.length > 0 && <ol className="space-y-1.5 border-t border-[#DFEAE3] pt-2">{j.events.map(ev => <li key={ev.id} className="break-words"><span className="font-semibold text-brand-dark">{label(ev.status)}</span> · {ev.note}</li>)}</ol>}
          </div>
        </details>
        {j.refundStatus !== "NONE" && <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">Refund requires admin review. No refund has been confirmed here.</p>}
      </div>

      {open && <LoadingForm onSubmit={onSubmit} aria-label={`Manage ${j.snapshot.name}`} className="flex min-w-0 flex-col gap-3 self-start rounded-xl border border-[#DFEAE3] bg-[#FBFDFA] p-3.5 sm:p-4">
        <p className="text-sm font-semibold text-brand-dark">Manage booking</p>
        <label className="block text-[13px] font-medium text-brand-dark">Action<select name="status" className={`${field} h-11`}>{bookingActions("customer", j).map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="block text-[13px] font-medium text-brand-dark">Requested / scheduled date<input type="datetime-local" name="date" className={`${field} h-11`} /></label>
        <label className="block text-[13px] font-medium text-brand-dark">Note / evidence<textarea name="note" minLength={3} maxLength={2000} required rows={3} placeholder="Add a note or details for this booking" className={`${field} resize-y py-2.5 font-normal`} /><span className="mt-1 block text-xs font-normal text-darkText/50">Required, at least 3 characters.</span></label>
        <LoadingButton className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-hover"><Save className="h-4 w-4" aria-hidden="true" />Save</LoadingButton>
      </LoadingForm>}
    </div>
  </article>;
}
