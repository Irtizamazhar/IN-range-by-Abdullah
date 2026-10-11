import Link from "@/components/ui/LoadingLink";
import { Search } from "lucide-react";
import { normalizeSearchQuery, searchPublicMarketplace, type SearchItem, type SearchKind } from "@/lib/public-search";

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
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-9"><p className="text-xs font-black uppercase tracking-widest text-lime-300">Explore JORO</p><h1 className="mt-2 text-3xl font-black">Search the marketplace</h1><form action="/search" className="mt-5 flex max-w-2xl gap-2"><input name="q" defaultValue={query} maxLength={100} aria-label="Search JORO" placeholder="Search products, services, gifts & more..." className="min-w-0 flex-1 rounded-xl px-4 py-3 text-emerald-950" /><button className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 font-bold text-brand-dark"><Search className="h-4 w-4" /> Search</button></form></div>
    {query.length >= 2 && <><nav aria-label="Search result types" className="mt-6 flex gap-2 overflow-x-auto pb-2">{tabs.map((tab) => <Link key={tab.value} href={tabHref(tab.value)} aria-current={type === tab.value ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${type === tab.value ? "bg-emerald-900 text-white" : "bg-white text-emerald-900"}`}>{tab.label}</Link>)}</nav><p className="my-5 text-sm text-neutral-600">{error ? "Search is temporarily unavailable." : `${visible.length} results shown for “${query}”`}</p>{!error && (visible.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((item) => <Result key={`${item.kind}-${item.id}`} item={item} query={query} />)}</div> : <div className="rounded-2xl border bg-white p-8 text-center text-neutral-600">No public results match this search. Try a different term.</div>)}</>}
    {query.length < 2 && <p className="mt-6 text-neutral-600">Enter at least two characters to search public listings.</p>}
  </main>;
}
