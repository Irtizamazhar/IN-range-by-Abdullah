import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { LayoutGrid, Search } from "lucide-react";
import { normalizeSearchQuery, searchPublicMarketplace, type SearchItem, type SearchKind } from "@/lib/public-search";
import { TryDifferentSearchButton } from "./TryDifferentSearchButton";

export const dynamic = "force-dynamic";

const tabs: { value: SearchKind | "all"; label: string }[] = [
  { value: "all", label: "All" }, { value: "products", label: "Products" },
  { value: "services", label: "Services" }, { value: "gifts", label: "Gifts" },
  { value: "requests", label: "Requests" }, { value: "stores", label: "Stores" },
];

function Highlight({ value, query }: { value: string; query: string }) {
  const start = value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (start < 0) return <>{value}</>;
  return <>{value.slice(0, start)}<mark className="rounded bg-lime-200 px-0.5 text-inherit">{value.slice(start, start + query.length)}</mark>{value.slice(start + query.length)}</>;
}

function Result({ item, query }: { item: SearchItem; query: string }) {
  return <Link href={item.href} className="block rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
    <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">{item.kind === "categories" ? item.detail : item.kind}</span>
    <h2 className="mt-1 text-lg font-bold text-emerald-950"><Highlight value={item.title} query={query} /></h2>
    {item.kind !== "categories" && <p className="mt-1 text-sm text-neutral-600">{item.detail}</p>}
  </Link>;
}

/** Shown instead of a result list when nothing matches; the header search stays the only search field. */
function NoResults({ query, type, standalone = false }: { query: string; type: SearchKind | "all"; standalone?: boolean }) {
  const noun = type === "all" ? "products" : type;
  const Heading = standalone ? "h1" : "h2";
  return <section aria-labelledby="no-results-heading" className="mx-auto flex max-w-2xl flex-col items-center py-6 text-center sm:py-10">
    <Image src="/images/search/joro-no-results.webp" alt="" width={960} height={536} priority unoptimized sizes="(min-width: 640px) 480px, 92vw" className="h-auto w-full max-w-[340px] sm:max-w-[480px]" />
    <Heading id="no-results-heading" className="mt-4 break-words text-2xl font-black leading-tight tracking-tight text-darkText sm:mt-6 sm:text-[34px]">No {noun} found for “{query}”</Heading>
    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-neutral-600 sm:text-base">We couldn&apos;t find any {noun} matching your search. Try a different keyword or explore our marketplace.</p>
    <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
      <TryDifferentSearchButton className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-brand-primary px-6 text-base font-bold text-brand-dark shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:w-auto" />
      <Link href="/products" className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-300 bg-white px-6 text-base font-bold text-darkText transition hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:w-auto"><LayoutGrid className="h-5 w-5" aria-hidden="true" />Browse all categories</Link>
    </div>
  </section>;
}

export default async function SearchPage({ searchParams }: { searchParams?: { q?: string; type?: string } }) {
  const query = normalizeSearchQuery(searchParams?.q || "");
  const type = tabs.find((tab) => tab.value === searchParams?.type)?.value || "all";
  let items: SearchItem[] = [];
  let error = false;
  if (query.length >= 2) {
    try { items = await searchPublicMarketplace(query, 20); }
    catch (reason) { console.error("Public search failed", reason); error = true; }
  }
  const visible = type === "all" ? items : items.filter((item) => item.kind === type);
  const tabHref = (value: string) => `/search?q=${encodeURIComponent(query)}${value === "all" ? "" : `&type=${value}`}`;
  // Nothing matched at all: only the empty state, without the extra search banner or tabs.
  if (query.length >= 2 && !error && items.length === 0) return <main className="mx-auto max-w-site px-4 py-8 sm:px-6"><NoResults query={query} type={type} standalone /></main>;
  return <main className="mx-auto max-w-site px-4 py-8 sm:px-6">
    <div className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-9"><p className="text-xs font-black uppercase tracking-widest text-lime-300">Explore JORO</p><h1 className="mt-2 text-3xl font-black">Search the marketplace</h1><form action="/search" className="mt-5 flex max-w-2xl gap-2"><input name="q" defaultValue={query} maxLength={100} aria-label="Search JORO" placeholder="Search products, services, gifts & more..." className="min-w-0 flex-1 rounded-xl px-4 py-3 text-emerald-950" /><button className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 font-bold text-brand-dark"><Search className="h-4 w-4" /> Search</button></form></div>
    {query.length >= 2 && <><nav aria-label="Search result types" className="mt-6 flex gap-2 overflow-x-auto pb-2">{tabs.map((tab) => <Link key={tab.value} href={tabHref(tab.value)} aria-current={type === tab.value ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${type === tab.value ? "bg-emerald-900 text-white" : "bg-white text-emerald-900"}`}>{tab.label}</Link>)}</nav><p className="my-5 text-sm text-neutral-600">{error ? "Search is temporarily unavailable." : `${visible.length} results shown for “${query}”`}</p>{!error && (visible.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((item) => <Result key={`${item.kind}-${item.id}`} item={item} query={query} />)}</div> : <NoResults query={query} type={type} />)}</>}
    {query.length < 2 && <p className="mt-6 text-neutral-600">Enter at least two characters to search public listings.</p>}
  </main>;
}
