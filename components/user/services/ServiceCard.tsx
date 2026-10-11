import Link from "@/components/ui/LoadingLink";
import { MapPin, Wrench } from "lucide-react";
import { serviceCities } from "@/lib/public-services";

export type PublicService = {
  id: string; name: string; description: string; type: string; price: unknown; cities: unknown;
  vendor: { id: string; shopName: string; storeSlug: string | null };
};

export function ServiceCard({ service }: { service: PublicService }) {
  return <article className="flex min-w-0 flex-col rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-100 text-emerald-900"><Wrench aria-hidden="true" /></div>
    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-emerald-700">{service.type}</p>
    <h3 className="mt-1 text-lg font-black text-emerald-950"><Link href={`/services/${service.id}`}>{service.name}</Link></h3>
    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{service.description}</p>
    <Link href={`/stores/${service.vendor.storeSlug || service.vendor.id}`} className="mt-3 text-sm font-semibold text-emerald-800 hover:underline">{service.vendor.shopName}</Link>
    <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><MapPin size={14} aria-hidden="true" />{serviceCities(service.cities).join(", ")}</p>
    <div className="mt-auto flex items-end justify-between gap-2 pt-5"><p className="text-sm text-gray-500">Starting at <strong className="block text-lg text-emerald-950">PKR {Number(service.price).toLocaleString("en-PK")}</strong></p><Link href={`/services/${service.id}`} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-dark">View service</Link></div>
  </article>;
}
