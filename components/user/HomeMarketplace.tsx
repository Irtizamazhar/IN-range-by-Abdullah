import Link from "@/components/ui/LoadingLink";
import { ArrowRight, Check, Crown, Star, TrendingUp } from "lucide-react";
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
  <section id="stores" aria-label="Top Sellers" className="relative isolate overflow-hidden rounded-3xl border border-[#E3F0DA] bg-gradient-to-br from-[#F3FAEC] via-[#F9FCF6] to-[#EAF6E0] p-5 text-brand-dark shadow-[0_10px_30px_rgba(0,64,43,0.05)] sm:p-7">
    <span className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-white/50" aria-hidden="true" />
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0F5C36] to-[#063B22] shadow-[0_0_0_5px_rgba(183,227,58,0.25)] sm:h-12 sm:w-12" aria-hidden="true"><Crown className="h-5 w-5 fill-[#F5D23C] text-[#F5D23C]" strokeWidth={2} /></span>
        <div className="min-w-0">
          <h2 className="relative inline-block text-2xl font-black tracking-tight text-[#0B3D24] sm:text-3xl">Top Sellers<span className="absolute -right-5 -top-2 flex gap-0.5" aria-hidden="true"><span className="h-2.5 w-[3px] -rotate-12 rounded-full bg-[#9BD83A]" /><span className="mt-0.5 h-2.5 w-[3px] rotate-[35deg] rounded-full bg-[#9BD83A]" /></span></h2>
          <p className="mt-0.5 text-sm text-neutral-500">Meet our most trusted and active sellers on JORO.</p>
        </div>
      </div>
      <Link href="/stores" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0B4A2E] to-[#15703D] px-5 py-2.5 text-sm font-bold text-white shadow-[0_6px_16px_rgba(11,74,46,0.25)] ring-2 ring-[#CBEB7E] transition hover:brightness-110">View all sellers <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </header>
    {stores.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stores.map(store => <Link key={store.id} href={`/stores/${store.storeSlug || store.id}`} className="relative flex h-[149px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-[#E1EFD6] bg-white p-5 shadow-[0_8px_20px_rgba(0,64,43,0.07)] transition duration-200 hover:border-[#C9E4B6] hover:shadow-[0_12px_26px_rgba(0,64,43,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link xl:gap-4">
      <span className="pointer-events-none absolute right-0 top-0 flex h-12 w-12 items-start justify-end rounded-bl-[36px] bg-gradient-to-bl from-[#C8EE6A] to-[#EEF9D2] p-2" aria-hidden="true"><Star className="h-4 w-4 text-[#0B3D24]" strokeWidth={2.2} /></span>
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E6F8E2] to-[#CDEFC6] text-lg font-black text-[#0B3D24] ring-4 ring-[#F1FAEA] xl:h-16 xl:w-16 xl:text-xl">{store.shopName.slice(0, 2).toUpperCase()}<span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2E9E3E] ring-2 ring-white" aria-hidden="true"><Check className="h-3 w-3 text-white" strokeWidth={3.2} /></span></span>
      <div className="min-w-0 flex-1 pr-5">
        <h3 className="truncate text-base font-extrabold text-[#102423] xl:text-lg" title={store.shopName}>{store.shopName}</h3>
        <p className="truncate text-sm text-neutral-500">{store.primaryCategory}</p>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#E9F8C7] px-2.5 py-1 text-xs font-bold text-[#0B3D24]"><Crown className="h-3.5 w-3.5 text-[#B88A00]" strokeWidth={2.2} aria-hidden="true" />Top Seller</span>{store.rating.reviewCount > 0 && <span className="whitespace-nowrap text-xs font-semibold text-brand-link">★ {store.rating.ratingAvg.toFixed(1)} ({store.rating.reviewCount})</span>}</span>
      </div>
    </Link>)}</div> : <p className="text-neutral-500">No featured sellers yet.</p>}
  </section>
</div>; }

/** Latest active products (already limited to 12 by lib/home-all-products); products under 14 days old show a "New" tag. Hidden when there are none. */
export function HomeAllProducts({ products }: { products: ProductCardData[] }) { if (!products.length) return null; return <div className="mx-auto max-w-site px-4 py-10 sm:px-6">
  <section id="all-products" aria-labelledby="all-products-heading">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="all-products-heading" className="text-xl font-black tracking-tight text-emerald-950 min-[400px]:text-2xl sm:text-3xl">All Products</h2><Link href="/products" className={HOME_VIEW_BUTTON}>View all products →</Link></header>
    <div className={HOME_PRODUCT_GRID}>{products.map(product => <HomeProductCard key={product._id} product={product} featured showNewTag />)}</div>
  </section>
</div>; }
