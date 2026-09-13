"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Sparkles,
} from "lucide-react";

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
  const [
    products,
    setProducts,
  ] =
    useState<ProductCardData[]>(
      initialProducts
    );

  const productsRef =
    useRef(products);

  const [total, setTotal] =
    useState(totalCount);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    productsRef.current =
      products;
  }, [products]);

  const hasMore =
    products.length < total;

  const loadMore =
    useCallback(async () => {
      if (
        loading ||
        !hasMore
      ) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params =
          new URLSearchParams({
            offset: String(
              productsRef.current
                .length
            ),
            limit: String(
              pageSize
            ),
          });

        const response =
          await fetch(
            `/api/products/bestsellers?${params.toString()}`
          );

        const data =
          (await response.json()) as ApiBestSellersResponse;

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Could not load more"
          );
        }

        const batch =
          data.products ?? [];

        setTotal(
          typeof data.total ===
            "number"
            ? data.total
            : total
        );

        setProducts(
          (previous) => {
            const seen =
              new Set(
                previous.map(
                  (product) =>
                    product._id
                )
              );

            const merged = [
              ...previous,
            ];

            for (const product of batch) {
              if (
                !seen.has(
                  product._id
                )
              ) {
                seen.add(
                  product._id
                );

                merged.push(
                  product
                );
              }
            }

            return merged;
          }
        );
      } catch (err) {
        setError(
          err instanceof
            Error
            ? err.message
            : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    }, [
      hasMore,
      loading,
      pageSize,
      total,
    ]);

  if (totalCount === 0) {
    return null;
  }

  return (
    <section className="bg-white py-9 sm:py-11">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-brand-link">
              <Sparkles className="h-3.5 w-3.5" />

              Handpicked for you
            </div>

            <h2 className="text-[24px] font-black tracking-[-0.035em] text-brand-dark sm:text-[28px]">
              Featured Products
            </h2>

            <p className="mt-1 text-[13px] font-medium text-black/45 sm:text-sm">
              Popular products from the marketplace.
            </p>
          </div>

          {hasMore ? (
            <button
              type="button"
              disabled={
                loading
              }
              onClick={
                loadMore
              }
              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-black text-brand-link transition hover:text-brand-dark disabled:opacity-50"
            >
              {loading
                ? "Loading..."
                : "View More"}

              {!loading ? (
                <ArrowRight className="h-3.5 w-3.5" />
              ) : null}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {products.map(
            (product) => (
              <ProductCard
                key={
                  product._id
                }
                product={
                  product
                }
                ribbon="TOP PICK"
                badgePosition="right"
              />
            )
          )}

          {loading
            ? Array.from({
                length:
                  Math.min(
                    pageSize,
                    6
                  ),
              }).map(
                (
                  _,
                  index
                ) => (
                  <ProductCardSkeleton
                    key={`best-loading-${index}`}
                  />
                )
              )
            : null}
        </div>

        {error ? (
          <p className="mt-4 text-center text-xs font-semibold text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
