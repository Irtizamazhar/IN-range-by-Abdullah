"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ProductCard,
  ProductCardSkeleton,
  type ProductCardData,
} from "@/components/user/ProductCard";

type ApiBestSellersResponse = {
  products?: ProductCardData[];
  total?: number;
  error?: string;
};

export function BestSellersSection({
  initialProducts,
  totalCount,
  pageSize,
}: {
  initialProducts: ProductCardData[];
  totalCount: number;
  pageSize: number;
}) {
  const [products, setProducts] = useState<ProductCardData[]>(initialProducts);
  const productsRef = useRef(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showMoreButton = totalCount > 0;

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const offset = productsRef.current.length;
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(pageSize),
      });
      const res = await fetch(`/api/products/bestsellers?${params.toString()}`);
      const data = (await res.json()) as ApiBestSellersResponse;
      if (!res.ok) {
        throw new Error(data.error || "Could not load more");
      }
      const batch = data.products ?? [];
      const serverTotal = typeof data.total === "number" ? data.total : total;
      setTotal(serverTotal);

      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        const merged = [...prev];
        for (const p of batch) {
          if (!seen.has(p._id)) {
            seen.add(p._id);
            merged.push(p);
          }
        }
        return merged;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [loading, total, pageSize]);

  if (totalCount === 0) {
    return null;
  }

  return (
    <section className="bg-white py-14">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-center text-3xl font-black text-gray-900">
          Best Sellers
        </h2>
        <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-primaryYellow" />

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              ribbon="BEST"
            />
          ))}
          {loading
            ? Array.from({ length: pageSize }).map((_, i) => (
                <ProductCardSkeleton key={`loading-${i}`} />
              ))
            : null}
        </div>

        {error ? (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        ) : null}

        {showMoreButton ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={loadMore}
              className="inline-flex min-w-[140px] justify-center rounded-xl border-2 border-primaryBlue bg-white px-10 py-3 font-bold text-primaryBlue shadow-sm transition-colors hover:bg-primaryBlue hover:text-white disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? "Loading…" : "More"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
