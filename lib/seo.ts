import { productPath } from "@/lib/catalog-urls";
import type { Metadata } from "next";

export const SITE_URL = "https://joro.pk";
export const HOME_TITLE = "JORO.PK | Online Shopping, Services & Wants in Pakistan";
export const HOME_DESCRIPTION = "Shop products, explore services and post your Wants on JORO.PK. Discover Pakistan's marketplace connecting customers, sellers and service providers.";
export const absoluteUrl = (pathname: string) => new URL(pathname, SITE_URL).href;
export function seoText(value: string | null | undefined, limit = 160) {
  return (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}
export function publicImageUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    if (!(value.startsWith("/") && !value.startsWith("//")) && !value.startsWith("https://")) return undefined;
    const url = new URL(value, SITE_URL);
    if (url.username || url.password || url.protocol !== "https:") return undefined;
    if (url.origin === SITE_URL && url.pathname.startsWith("/api/") && !/^\/api\/(?:image|uploads)\//.test(url.pathname)) return undefined;
    return url.href;
  } catch { return undefined; }
}
export function pageMetadata(title: string, description: string, pathname: string, image?: string | null, noindex = false): Metadata {
  const fullTitle = title === HOME_TITLE ? title : `${seoText(title, 120)} | JORO.PK`;
  const summary = seoText(description, 170) || HOME_DESCRIPTION;
  const photo = publicImageUrl(image);
  return {
    title: { absolute: fullTitle }, description: summary,
    alternates: { canonical: absoluteUrl(pathname) },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", siteName: "JORO.PK", locale: "en_PK", title: fullTitle, description: summary, url: absoluteUrl(pathname), images: [{ url: photo || `${SITE_URL}/icon.png`, alt: title }] },
    twitter: { card: photo ? "summary_large_image" : "summary", title: fullTitle, description: summary, images: [photo || `${SITE_URL}/icon.png`] },
  };
}
export function breadcrumbs(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })) };
}
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
/** Google supports merchantReturnLink alone; do not turn a notification deadline into a return window. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#organization`,
    name: "JORO.PK", url: SITE_URL, logo: `${SITE_URL}/icon.png`,
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy", merchantReturnLink: absoluteUrl("/return-policy"),
    },
  };
}
export function productSchema(product: { id: string; slug?: string | null; name: string; description: string; category: string; price: unknown; stock: number; images: string[] }, seller?: { name: string; path: string } | null) {
  const price = Number(product.price);
  return { "@context": "https://schema.org", "@type": "Product", name: product.name, description: seoText(product.description, 5000), category: product.category,
    url: absoluteUrl(productPath(product)), image: product.images.map(publicImageUrl).filter(Boolean),
    ...(Number.isFinite(price) && price >= 0 ? { offers: { "@type": "Offer", url: absoluteUrl(productPath(product)), price, priceCurrency: "PKR",
      availability: `https://schema.org/${product.stock > 0 ? "InStock" : "OutOfStock"}`,
      ...(seller ? { seller: { "@type": "Organization", name: seller.name, url: absoluteUrl(seller.path) } } : {}),
    } } : {}),
  };
}
