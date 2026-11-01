import { ServiceImage } from "./ServiceImage";
import Link from "@/components/ui/LoadingLink";
import { MapPin } from "lucide-react";
import { coverageLabel } from "@/lib/service-coverage";

export type PublicService = {
  id: string; name: string; description: string; type: string; price: unknown; cities: unknown; coverage?: unknown; priceType?: string; imageUrl?: string | null; catalog?: { imageUrl?: string | null } | null;
  vendor: { id: string; shopName: string; storeSlug: string | null };
};

export function ServiceCard({ service, featured = false }: { service: PublicService; featured?: boolean }) {
  return <article className={featured
    ? "flex h-full min-w-0 flex-col rounded-[20px] border border-[#E3EBDB] bg-white p-4 shadow-[0_4px_16px_rgba(17,17,17,.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
    : "flex min-w-0 flex-col rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"}>
    <ServiceImage imageUrl={service.imageUrl} defaultImageUrl={service.catalog?.imageUrl} alt={service.name} className="mb-3" />
    <div>
      <p className={featured
        ? "min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-emerald-700"
        : "mt-4 text-xs font-bold uppercase tracking-wide text-emerald-700"} title={service.type}>{service.type}</p>
    </div>
    <h3 className={featured
      ? "mt-3 line-clamp-2 min-h-[2.5em] break-words text-base font-black leading-[1.25] text-emerald-950"
      : "mt-1 text-lg font-black text-emerald-950"}><Link href={`/services/${service.id}`}>{service.name}</Link></h3>
    <p className={featured
      ? "mt-1.5 line-clamp-2 min-h-10 break-words text-[13px] leading-5 text-gray-600"
      : "mt-2 line-clamp-2 text-sm text-gray-600"}>{service.description}</p>
    <Link href={`/stores/${service.vendor.storeSlug || service.vendor.id}`} title={service.vendor.shopName} className={featured
      ? "mt-2.5 block max-w-full truncate text-xs font-semibold text-emerald-800 hover:underline"
      : "mt-3 text-sm font-semibold text-emerald-800 hover:underline"}>{service.vendor.shopName}</Link>
    <p className={featured
      ? "mt-1.5 flex min-w-0 items-center gap-1 text-xs text-gray-500"
      : "mt-2 flex items-center gap-1 text-xs text-gray-500"}><MapPin size={14} className="shrink-0" aria-hidden="true" /><span className={featured ? "truncate" : ""} title={coverageLabel(service.coverage, service.cities)}>{coverageLabel(service.coverage, service.cities)}</span></p>
    <div className={featured
      ? "mt-auto flex flex-wrap items-end justify-between gap-2 pt-4"
      : "mt-auto flex items-end justify-between gap-2 pt-5"}>
      <p className={featured ? "text-xs leading-tight text-gray-500" : "text-sm text-gray-500"}>{service.priceType === "FIXED" ? "Fixed Price" : "Starting From"} <strong className={featured ? "mt-0.5 block text-base font-black text-emerald-950" : "block text-lg text-emerald-950"}>PKR {Number(service.price).toLocaleString("en-PK")}</strong></p>
      <Link href={`/services/${service.id}`} className={featured
        ? "rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-brand-dark transition hover:brightness-95"
        : "rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-dark"}>View service</Link>
    </div>
  </article>;
}
