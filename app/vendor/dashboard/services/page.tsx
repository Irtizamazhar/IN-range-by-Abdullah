"use client";
import { wholeNumberInputProps } from "@/lib/whole-number-input";

import { useCallback, useEffect, useState } from "react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ServiceBookings } from "@/components/user/ServiceBookings";
import { formatPKR } from "@/lib/format";

type Service = {
  id: string; name: string; description: string; type: string; price: string;
  cities: string[]; durationMinutes: number; leadDays: number; warranty: string;
  cancellationTerms: string; active: boolean; moderationStatus: string;
  moderationReason: string | null;
};
type Addon = { id: string; active: boolean; product: { name: string }; service: { name: string } };

const field = "mt-1 block w-full min-w-0 rounded-xl border border-[#DFEDE5] bg-white px-3 py-2.5 text-[#123D27] focus:border-[#005235] focus:outline-none focus:ring-2 focus:ring-[#B7E33A]/40";
const card = "rounded-2xl border border-[#DFEDE5] bg-white p-5 shadow-sm sm:p-6";

function servicePayload(service: Service, active: boolean) {
  return {
    id: service.id, name: service.name, description: service.description,
    type: service.type, price: Number(service.price), cities: service.cities,
    durationMinutes: service.durationMinutes, leadDays: service.leadDays,
    warranty: service.warranty, cancellationTerms: service.cancellationTerms, active,
  };
}

export default function VendorServices() {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/vendor/services", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load services.");
      setServices(data.services);
      setProducts(data.products);
      setAddons(data.addons);
      setBookingCount(data.bookingCount);
      setServiceTypes(data.serviceTypes);
      setLoadFailed(false);
    } catch (error) {
      setLoadFailed(true);
      setMessage(error instanceof Error ? error.message : "Could not load services.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    try {
      const response = await fetch("/api/vendor/services", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save service.");
      setMessage("Service changes saved. Existing purchase terms remain unchanged.");
      await load();
      if (body.action !== "attach") { setEditing(null); setShowForm(false); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save service.");
    }
  }

  if (loading) return <PageSkeleton label="Loading services…" variant="cards" />;
  const approved = services.filter(service => service.moderationStatus === "APPROVED");
  const eligible = approved.filter(service => service.active);

  return <main className="mx-auto max-w-6xl space-y-7 p-4 text-[#123D27] sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#005235]">JORO Vendor</p>
        <h1 className="mt-1 text-3xl font-black text-[#063D2B]">My Services</h1>
        <p className="mt-2 text-sm text-[#506257]">Manage your services, bookings and product add-ons.</p>
      </div>
      <LoadingButton type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-xl bg-[#B7E33A] px-5 py-3 font-bold text-[#063D2B]">+ Add Service</LoadingButton>
    </header>
    {message && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${loadFailed ? "bg-red-50 text-red-800" : "bg-[#EFFBF4] text-[#005235]"}`}>{message}</p>}
    {loadFailed && <LoadingButton onClick={load} className="rounded-xl border border-[#DFEDE5] bg-white px-4 py-2 font-bold">Retry loading services</LoadingButton>}

    <section aria-label="Service summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["Total Services", services.length],
        ["Active Services", services.filter(service => service.active && service.moderationStatus === "APPROVED").length],
        ["Pending Review", services.filter(service => service.moderationStatus !== "APPROVED" && service.moderationStatus !== "HIDDEN").length],
        ["Total Bookings", bookingCount],
      ].map(([label, count]) => <div key={label} className={card}><p className="text-sm text-[#506257]">{label}</p><p className="mt-2 text-3xl font-black text-[#005235]">{count}</p></div>)}
    </section>

    {showForm && <section className={card}>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-black text-[#005235]">{editing ? "Edit Service" : "Add Service"}</h2><LoadingButton type="button" onClick={() => { setEditing(null); setShowForm(false); }} className="rounded-lg border px-3 py-2 text-sm">Close</LoadingButton></div>
      <LoadingForm key={editing?.id || "new"} className="grid gap-4 sm:grid-cols-2" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        return post({
          ...(editing ? { id: editing.id } : {}),
          name: form.get("name"), description: form.get("description"), type: form.get("type"),
          price: Number(form.get("price")), cities: String(form.get("cities")).split(",").map(city => city.trim()).filter(Boolean),
          durationMinutes: Number(form.get("duration")), leadDays: Number(form.get("lead")),
          warranty: form.get("warranty"), cancellationTerms: form.get("cancellation"), active: form.get("active") === "on",
        });
      }}>
        <label className="text-sm font-bold">Service name<input className={field} name="name" defaultValue={editing?.name} required maxLength={160} /></label>
        <label className="text-sm font-bold">Service category<select className={field} name="type" defaultValue={editing?.type || ""} required><option value="">Select service type</option>{editing?.type && !serviceTypes.includes(editing.type) && <option value={editing.type}>{editing.type} (legacy)</option>}{serviceTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <label className="text-sm font-bold">Starting price (PKR)<input className={field} name="price" type="number" min={1} defaultValue={editing?.price == null ? undefined : Math.round(Number(editing.price))} required {...wholeNumberInputProps} /></label>
        <label className="text-sm font-bold">Coverage cities (comma-separated)<input className={field} name="cities" defaultValue={editing?.cities.join(", ")} required /></label>
        <label className="text-sm font-bold">Duration in minutes<input className={field} name="duration" type="number" min={1} defaultValue={editing?.durationMinutes || 60} required /></label>
        <label className="text-sm font-bold">Lead time in days<input className={field} name="lead" type="number" min={0} defaultValue={editing?.leadDays ?? 1} required /></label>
        <label className="text-sm font-bold sm:col-span-2">What is included / not included<textarea className={field} name="description" defaultValue={editing?.description} required maxLength={5000} rows={3} /></label>
        <label className="text-sm font-bold">Warranty<input className={field} name="warranty" defaultValue={editing?.warranty || ""} maxLength={1000} /></label>
        <label className="text-sm font-bold sm:col-span-2">Cancellation & scheduling terms<textarea className={field} name="cancellation" defaultValue={editing?.cancellationTerms} required maxLength={5000} rows={3} /></label>
        <label className="flex items-center gap-2 text-sm font-bold"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} className="h-4 w-4 accent-[#005235]" />Active</label>
        <LoadingButton type="submit" loadingLabel="Saving…" className="rounded-xl bg-[#B7E33A] px-5 py-3 font-bold text-[#063D2B] sm:col-span-2">{editing ? "Update Service" : "Create Service"}</LoadingButton>
      </LoadingForm>
    </section>}

    <section className={card}>
      <h2 className="text-xl font-black text-[#005235]">Service Listings</h2>
      {services.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{services.map(service => <article key={service.id} className="min-w-0 rounded-xl border border-[#DFEDE5] bg-[#F7FAF7] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold text-[#063D2B]">{service.name}</h3><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#005235]">{service.moderationStatus}</span></div>
        <p className="mt-1 text-sm text-[#506257]">{service.type} · {service.cities.join(", ")}</p>
        <p className="mt-3 text-lg font-black text-[#005235]">{formatPKR(Number(service.price))}</p>
        <p className="mt-1 text-xs text-[#506257]">{service.active ? "Active" : "Inactive"} · {service.durationMinutes} min · {service.leadDays} day lead time</p>
        {service.moderationReason && <p className="mt-2 text-xs text-red-700">{service.moderationReason}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><LoadingButton type="button" disabled={service.moderationStatus !== "APPROVED"} onClick={() => { setEditing(service); setShowForm(true); }} className="rounded-lg border border-[#DFEDE5] bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">Edit</LoadingButton><LoadingButton type="button" disabled={service.moderationStatus !== "APPROVED"} onClick={() => post(servicePayload(service, !service.active))} className="rounded-lg border border-[#DFEDE5] bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{service.active ? "Disable" : "Enable"}</LoadingButton></div>
      </article>)}</div> : <p className="mt-4 rounded-xl bg-[#F7FAF7] p-6 text-sm text-[#506257]">No services yet. Add your first service to make it available for review.</p>}
    </section>

    <section className={card}>
      <h2 className="text-xl font-black text-[#005235]">Product Service Add-ons</h2>
      <p className="mt-1 text-sm text-[#506257]">Link an approved service to a product from your own store.</p>
      <LoadingForm className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        return post({ action: "attach", productId: form.get("productId"), serviceId: form.get("serviceId"), active: form.get("active") === "on" });
      }}>
        <label className="text-sm font-bold">Own product<select className={field} name="productId" required defaultValue=""><option value="">Select a product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label className="text-sm font-bold">Eligible service<select className={field} name="serviceId" required defaultValue=""><option value="">Select a service</option>{eligible.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm font-bold lg:self-center"><input name="active" type="checkbox" defaultChecked className="h-4 w-4 accent-[#005235]" />Enable add-on</label>
        <LoadingButton type="submit" disabled={!products.length || !eligible.length} loadingLabel="Saving…" className="rounded-xl bg-[#B7E33A] px-5 py-3 font-bold text-[#063D2B] disabled:opacity-50">Save Product Add-on</LoadingButton>
      </LoadingForm>
      {!products.length || !eligible.length ? <p className="mt-3 text-sm text-[#506257]">An owned product and an active approved service are needed before linking an add-on.</p> : null}
      {addons.length > 0 && <div className="mt-5 space-y-2">{addons.map(addon => <p key={addon.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-[#DFEDE5] px-4 py-3 text-sm"><span>{addon.product.name} · {addon.service.name}</span><strong className="text-[#005235]">{addon.active ? "Enabled" : "Disabled"}</strong></p>)}</div>}
    </section>

    <section className={card}><h2 className="text-xl font-black text-[#005235]">Service Bookings</h2><p className="mt-1 text-sm text-[#506257]">Actual customer bookings and permitted actions.</p><div className="mt-4"><ServiceBookings role="vendor" /></div></section>
  </main>;
}
