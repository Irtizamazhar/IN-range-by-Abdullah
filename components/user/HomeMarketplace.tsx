import Link from "@/components/ui/LoadingLink";
import { ArrowRight, TrendingUp } from "lucide-react";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { ServiceCard, type PublicService } from "./services/ServiceCard";
import { TrendingWantCard } from "./TrendingWantCard";
import { HOME_PRODUCT_GRID, HOME_VIEW_BUTTON, HomeProductCard } from "./HomeProductCard";

type MarketplaceWant = { id: string; title: string; requestType: string; city: string; photo: string | null; createdAt: Date; budgetMin: { toString(): string } | null; budgetMax: { toString(): string } | null; budgetFlexible: boolean; _count: { offers: number; interests: number }; joiners: { image: string | null; initial: string }[]; loved: boolean };
type MarketplaceStore = { id: string; shopName: string; storeSlug: string | null; primaryCategory: string | null; label: string | null; rating: { ratingAvg: number; reviewCount: number } };
function Heading({ title, href, link }: { title: string; href: string; link: string }) { return <header className="mb-5 flex items-end justify-between gap-3"><h2 className="text-2xl font-black tracking-tight text-emerald-950 sm:text-3xl">{title}</h2><Link href={href} className="shrink-0 rounded-xl bg-lime-100 px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-lime-200">{link} →</Link></header>; }
function ProductGrid({ products }: { products: ProductCardData[] }) { return products.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.slice(0, 5).map(product => <ProductCard key={product._id} product={product} variant="marketplace" />)}</div> : <p className="rounded-2xl border bg-white p-6 text-gray-600">No products available right now.</p>; }
export function HomeTrendingWants({ wants }: { wants: MarketplaceWant[] }) { return <div className="mx-auto max-w-site px-4 sm:px-6">
  <section id="trending-wants" aria-labelledby="trending-wants-heading" className="-mx-2.5 rounded-[24px] bg-[#F8FBF5] p-2.5 pt-4 sm:mx-0 sm:p-5">
    <header className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="trending-wants-heading" className="flex items-center gap-1.5 text-[22px] font-black tracking-tight text-[#003D36] sm:text-3xl">Trending Wants <TrendingUp className="h-5 w-5 shrink-0 text-[#63C52E] sm:h-6 sm:w-6" strokeWidth={2.5} aria-hidden="true" /></h2>
        <Link href="/wants?tab=trending" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#E8F8BE] px-3 text-[11px] font-bold text-[#00483B] shadow-[0_3px_10px_rgba(73,126,42,0.08)] transition hover:bg-[#DCF29F] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055] sm:min-h-10 sm:px-4 sm:text-sm">View all requests <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} aria-hidden="true" /></Link>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500 sm:text-sm">People are requesting these items and services</p>
    </header>
    {wants.length
      ? <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">{wants.map(want => <TrendingWantCard key={want.id} want={{
          id: want.id, title: want.title, requestType: want.requestType, city: want.city, photo: want.photo, createdAt: want.createdAt,
          budgetMin: want.budgetMin == null ? null : Number(want.budgetMin), budgetMax: want.budgetMax == null ? null : Number(want.budgetMax), budgetFlexible: want.budgetFlexible,
          joined: want._count.interests, offers: want._count.offers,
          joiners: want.joiners, loved: want.loved,
        }} />)}</div>
      : <div className="rounded-xl border border-dashed border-[#D9E6D0] bg-white px-6 py-8 text-center"><p className="font-bold text-emerald-950">No live requests yet</p><p className="mt-1 text-sm text-gray-600">When customers post what they need, it will show up here.</p><Link href="/wants" className="mt-3 inline-block text-sm font-bold text-emerald-800 hover:underline">Go to Wants →</Link></div>}
  </section>
</div>; }

export function HomeMarketplace({ services, gifts, stores }: { services: PublicService[]; gifts: ProductCardData[]; stores: MarketplaceStore[] }) { return <div data-home-marketplace className="mx-auto max-w-site space-y-10 px-4 py-10 sm:px-6">
  <section id="all-services"><Heading title="Services" href="/services" link="View all services" />{services.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{services.map(service => <ServiceCard key={service.id} service={service} featured />)}</div> : <p className="rounded-2xl border bg-white p-6 text-gray-600">No active services from approved vendors yet.</p>}</section>
  <section id="all-gifts"><Heading title="Gifts" href="/gifts" link="View all gifts" /><ProductGrid products={gifts} /><Link href="/wants/new?type=gift" className="mt-4 inline-block rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark">Request a custom gift</Link></section>
  <section id="stores" aria-label="Top Sellers" className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 text-brand-dark sm:p-7"><header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">Top Sellers</h2><Link href="/stores" className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark">View all sellers →</Link></header>{stores.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stores.map(store => <Link key={store.id} href={`/stores/${store.storeSlug || store.id}`} className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition duration-200 hover:border-neutral-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 font-black text-brand-link">{store.shopName.slice(0, 2).toUpperCase()}</span><h3 className="mt-3 break-words font-bold">{store.shopName}</h3><p className="mt-1 text-sm text-neutral-500">{store.primaryCategory}</p>{store.rating.reviewCount > 0 && <p className="mt-2 text-sm text-brand-link">★ {store.rating.ratingAvg.toFixed(1)} ({store.rating.reviewCount})</p>}</Link>)}</div> : <p className="text-neutral-500">No featured sellers yet.</p>}</section>
</div>; }

export function HomeAllProducts({ products }: { products: ProductCardData[] }) { return <div className="mx-auto max-w-site px-4 py-10 sm:px-6">
  <section id="all-products" aria-labelledby="all-products-heading">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="all-products-heading" className="text-xl font-black tracking-tight text-emerald-950 min-[400px]:text-2xl sm:text-3xl">All Products</h2><Link href="/products" className={HOME_VIEW_BUTTON}>View all products →</Link></header>
    {products.length
      // 12 when there are enough for two full desktop rows, otherwise one row of 6.
      ? <div className={HOME_PRODUCT_GRID}>{products.slice(0, products.length >= 12 ? 12 : 6).map(product => <HomeProductCard key={product._id} product={product} featured />)}</div>
      : <div className="rounded-2xl border border-dashed border-[#E3EBDB] bg-white px-6 py-8 text-center"><p className="font-bold text-emerald-950">No products yet</p><p className="mt-1 text-sm text-gray-600">New products from JORO sellers will appear here soon.</p><Link href="/products" className="mt-3 inline-block text-sm font-bold text-emerald-800 hover:underline">Browse all products →</Link></div>}
  </section>
</div>; }
