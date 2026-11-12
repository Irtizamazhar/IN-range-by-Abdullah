import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { homepageAdditions } from "@/lib/homepage-promotions";
import { serializeProduct } from "@/lib/serialize";
import { productPath } from "@/lib/catalog-urls";
import { formatPKR } from "@/lib/format";
import { displayDiscount } from "@/lib/product-discount";
import { requestCache as cache } from "@/lib/seo-cache";
const load = cache(homepageAdditions);
export async function HomepageAdditions({ placement }: { placement: "STRIP" | "BANNER" | "MID" | "LOWER" }) {
  const { promotions, featured } = await load();
  const rows = promotions.filter(row => row.placement === placement);
  if (!rows.length && !(featured && placement === "MID")) return null;
  return <section aria-label={placement === "STRIP" ? "Current JORO offers" : "Featured shopping"} className="mx-auto max-w-site space-y-4 px-4 py-3 sm:px-6">
    {rows.map(row => <article key={row.id} className={placement === "STRIP" ? "flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-950 px-4 py-3 text-white" : "relative isolate overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-5 sm:p-7"}>
      {row.image && placement !== "STRIP" && <div className="relative mb-4 aspect-[3/1] overflow-hidden rounded-xl"><Image src={row.image} alt="" fill sizes="(max-width: 639px) 90vw, 1100px" className="object-contain" /></div>}
      <div><h2 className="text-lg font-bold">{row.title}</h2>{row.subtitle && <p className="mt-1 text-sm">{row.subtitle}</p>}</div><Link href={row.href} className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-4 py-2 font-bold text-brand-dark">Shop Now →</Link>
    </article>)}
    {featured && placement === "MID" && (() => { const product = serializeProduct(featured), discount = displayDiscount(Number(featured.price), featured.originalPrice == null ? null : Number(featured.originalPrice)); return <article className="grid gap-5 rounded-2xl border border-emerald-100 bg-white p-5 sm:grid-cols-[200px_1fr] sm:p-7"><div className="relative aspect-square">{product.images[0] && <Image src={product.images[0]} alt={product.name} fill sizes="200px" className="object-contain" />}</div><div className="self-center"><p className="text-sm font-semibold text-emerald-800">Featured product</p><h2 className="mt-2 text-xl font-bold">{product.name}</h2><p className="mt-3 text-lg font-bold">{formatPKR(Number(product.price))}</p>{discount && <p className="text-sm text-neutral-600"><del>{formatPKR(discount.original)}</del> · {discount.percent}% less than the original price</p>}<Link href={productPath(featured)} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-5 font-bold text-brand-dark">Shop Now →</Link></div></article>; })()}
  </section>;
}
