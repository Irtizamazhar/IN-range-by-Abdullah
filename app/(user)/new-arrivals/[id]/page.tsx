"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ProductDetailClient,
  type ProductDetailProduct,
} from "@/app/(user)/products/[id]/ProductDetailClient";
import type { ProductCardData } from "@/components/user/ProductCard";

type NewArrival = {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  image: string;
  images?: string[];
  description?: string;
  stock?: number;
  inStock: boolean;
};

type StoreRow = NewArrival & { id: number };

function normalizeImages(item: Pick<NewArrival, "image" | "images">): string[] {
  if (item.images?.length) return item.images;
  if (item.image) return [item.image];
  return [];
}

function toProductDetailProduct(item: NewArrival): ProductDetailProduct {
  const images = normalizeImages(item);
  const stock = Math.max(0, Number(item.stock ?? (item.inStock ? 1 : 0)));
  const hasDiscount = item.originalPrice && item.originalPrice > item.price;
  const discountPercent =
    hasDiscount && item.originalPrice
      ? Math.round((1 - item.price / item.originalPrice) * 100)
      : undefined;
  return {
    _id: `na-${item.id}`,
    name: item.name,
    description: (item.description ?? "").trim(),
    price: item.price,
    originalPrice: item.originalPrice,
    discountPercent,
    images,
    category: item.category,
    stock,
    variants: [],
    ratingAvg: 0,
    reviewCount: 0,
  };
}

function rowToCard(p: StoreRow): ProductCardData {
  const images = normalizeImages(p);
  const hasDiscount = p.originalPrice && p.originalPrice > p.price;
  const stock = Math.max(0, Number(p.stock ?? (p.inStock ? 1 : 0)));
  return {
    _id: `na-${p.id}`,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    discountPercent:
      hasDiscount && p.originalPrice
        ? Math.round((1 - p.price / p.originalPrice) * 100)
        : undefined,
    images,
    category: p.category,
    href: `/new-arrivals/${p.id}`,
    stock,
    inStock: p.inStock,
  };
}

export default function NewArrivalDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [item, setItem] = useState<NewArrival | null>(null);
  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [detailRes, listRes] = await Promise.all([
          fetch(`/api/new-arrivals/${id}`),
          fetch(`/api/new-arrivals`),
        ]);
        if (!detailRes.ok) throw new Error("Not found");
        const data = (await detailRes.json()) as NewArrival;
        const listJson = listRes.ok ? await listRes.json() : { products: [] };
        const products = (listJson.products || []) as StoreRow[];
        if (cancelled) return;
        setItem({
          ...data,
          images: normalizeImages(data),
        });
        setRelated(
          products
            .filter((p) => String(p.id) !== id)
            .slice(0, 8)
            .map(rowToCard)
        );
      } catch {
        if (!cancelled) {
          setItem(null);
          setRelated([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 text-darkText/60">
        Loading…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 text-darkText/60">
        Product not found.
      </div>
    );
  }

  return (
    <ProductDetailClient
      product={toProductDetailProduct(item)}
      related={related}
      reviewsPostField={{ newArrivalId: item.id }}
    />
  );
}
