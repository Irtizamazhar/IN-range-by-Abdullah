"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Zap,
} from "lucide-react";

import {
  ProductCard,
  ProductCardSkeleton,
  type ProductCardData,
} from "@/components/user/ProductCard";

type ApiNewArrivalsResponse = {
  products?: ProductCardData[];
  total?: number;
  error?: string;
};

export function NewArrivalsSection({
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
            `/api/products/new-arrivals?${params.toString()}`
          );

        const data =
          (await response.json()) as ApiNewArrivalsResponse;

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

  return (
    <section className="bg-brand-background py-9 sm:py-11">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-brand-link">
              <Zap className="h-3.5 w-3.5" />

              Just added
            </div>

            <h2 className="text-[24px] font-black tracking-[-0.035em] text-brand-dark sm:text-[28px]">
              New Arrivals
            </h2>
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
              className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black text-brand-link transition hover:text-brand-dark disabled:opacity-50"
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

        {totalCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-10 text-center text-sm font-semibold text-black/40">
            No new arrivals at the moment.
          </div>
        ) : (
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
                  ribbon="NEW"
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
                      key={`new-loading-${index}`}
                    />
                  )
                )
              : null}
          </div>
        )}

        {error ? (
          <p className="mt-4 text-center text-xs font-semibold text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}