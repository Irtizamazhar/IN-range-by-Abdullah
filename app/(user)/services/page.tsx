import Link from "@/components/ui/LoadingLink";
import { ServiceCard } from "@/components/user/services/ServiceCard";
import { CategoryFilterRail } from "@/components/user/CategoryFilterRail";
import { publicServices } from "@/lib/public-services";
import { prisma } from "@/lib/prisma";
import { PakistanCitySelect } from "@/components/ui/PakistanCitySelect";
import { SERVICE_TYPES } from "@/lib/service-types";

export const dynamic = "force-dynamic";
export default async function ServicesPage({ searchParams }: { searchParams?: { search?: string; category?: string; city?: string } }) {
  const search = (searchParams?.search || "").trim().slice(0, 100);
  const category = (searchParams?.category || "").trim().slice(0, 100);
  const city = (searchParams?.city || "").trim().slice(0, 100);
  const [services, categories] = await Promise.all([
    publicServices({ search, category, city }),
    prisma.serviceOffering.findMany({ where: { active: true, moderationStatus: "APPROVED", vendor: { status: "approved" } }, distinct: ["type"], select: { type: true }, take: 100 }),
  ]);
  const categoryNames = Array.from(new Set([...SERVICE_TYPES, ...categories.map(item => item.type), ...(category ? [category] : [])]));
  const categoryItems = ["", ...categoryNames].map(value => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (city) params.set("city", city);
    if (value) params.set("category", value);
    return { value, label: value || "All services", href: `/services${params.size ? `?${params}` : ""}` };
  });
  return <main className="mx-auto max-w-site px-4 py-8 sm:px-6">
    <div className="rounded-3xl bg-[#123d27] p-7 text-white sm:p-10"><p className="text-sm font-bold uppercase tracking-widest text-lime-300">JORO services</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Find a trusted service provider</h1><p className="mt-3 max-w-2xl text-white/75">Explore active services from approved JORO vendors in your city.</p><Link href="/wants/new?type=service" className="mt-5 inline-block rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark">Post a service requirement</Link></div>
    <CategoryFilterRail label="Browse service categories" items={categoryItems} selected={category} />
    <form action="/services" className="mt-7 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <label className="text-sm font-semibold">Search services<input name="search" defaultValue={search} maxLength={100} placeholder="e.g. AC repair" className="mt-1 w-full rounded-xl border px-3 py-2.5" /></label>
      <label className="text-sm font-semibold">Category<select name="category" defaultValue={category} className="mt-1 min-h-11 w-full rounded-xl border px-3 py-2.5"><option value="">All categories</option>{categoryNames.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
      <label className="text-sm font-semibold">City<PakistanCitySelect name="city" defaultValue={city} maxLength={100} placeholder="All cities" wrapperClassName="mt-1" /></label>
      <button className="self-end rounded-xl bg-brand-primary px-5 py-2.5 font-bold text-brand-dark">Search</button>
    </form>
    <div className="mb-4 mt-8 flex items-baseline justify-between gap-3"><h2 className="text-2xl font-black text-emerald-950">Available services</h2><span className="text-sm text-gray-500">{services.length} shown</span></div>
    {services.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{services.map(service => <ServiceCard key={service.id} service={service} />)}</div> : <div className="rounded-2xl border bg-white p-8 text-center"><p>No services match these filters yet.</p><Link href="/wants/new?type=service" className="mt-3 inline-block font-bold text-emerald-800 underline">Post your service requirement</Link></div>}
  </main>;
}
