import type { ProductCardData } from "@/components/user/ProductCard";
import type { StoredProduct } from "@/lib/products-store";

export function storedProductToNewArrivalCard(p: StoredProduct): ProductCardData {
  const id = Number.isFinite(Number(p.id)) ? Number(p.id) : 0;
  const name = String(p.name ?? "").trim() || "Product";
  const price = Number.isFinite(Number(p.price)) ? Number(p.price) : 0;
  const origRaw =
    p.originalPrice == null ? undefined : Number(p.originalPrice);
  const originalPrice =
    typeof origRaw === "number" && Number.isFinite(origRaw) ? origRaw : undefined;

  const images =
    p.images && p.images.length > 0
      ? p.images.map(String).filter(Boolean)
      : p.image
        ? [String(p.image)]
        : [];
  const hasDisc =
    originalPrice != null && originalPrice > price;
  return {
    _id: `na-${id}`,
    name,
    price,
    originalPrice,
    discountPercent: hasDisc
      ? Math.round((1 - price / originalPrice!) * 100)
      : undefined,
    images,
    category: p.category || "New Arrivals",
    href: `/new-arrivals/${id}`,
    stock: p.stock,
    inStock: p.inStock,
    reviewCount: 0,
    ratingAvg: 0,
  };
}

export function sortedNewArrivalRows(products: StoredProduct[]) {
  return products
    .filter((p) => p.isNew)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
