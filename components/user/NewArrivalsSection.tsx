"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Zap } from "lucide-react";

import {
  ProductCard,
  ProductCardSkeleton,
  type ProductCardData,
} from "@/components/user/ProductCard";
import gridStyles from "@/components/user/ProductGrid.module.css";
import styles from "@/components/user/NewArrivalsSection.module.css";

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
  const [products, setProducts] = useState(initialProducts);
  const productsRef = useRef(products);
  const [total, setTotal] = useState(totalCount);
  const totalRef = useRef(totalCount);
  const [loadingCount, setLoadingCount] = useState(0);
  const requestInFlightRef = useRef(false);
  const autoLoadBlockedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(0);

  const loading = loadingCount > 0;
  const hasMore = products.length < total;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measureColumns = () => {
      const template = window.getComputedStyle(grid).gridTemplateColumns;
      setColumns(
        template && template !== "none"
          ? template.trim().split(/\s+/).length
          : 0
      );
    };

    measureColumns();
    const observer = new ResizeObserver(measureColumns);
    observer.observe(grid);
    // A media query can change card widths while the container stays the same size.
    window.addEventListener("resize", measureColumns);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureColumns);
    };
  }, [totalCount]);

  const loadProducts = useCallback(async (requestedCount: number) => {
    const current = productsRef.current;
    const count = Math.min(requestedCount, totalRef.current - current.length, 48);
    if (requestInFlightRef.current || count <= 0) return;

    requestInFlightRef.current = true;
    setLoadingCount(count);
    setError(null);

    try {
      const params = new URLSearchParams({
        offset: String(current.length),
        limit: String(count),
      });
      const response = await fetch(`/api/products/new-arrivals?${params.toString()}`);
      const data = (await response.json()) as ApiNewArrivalsResponse;

      if (!response.ok) {
        throw new Error(data.error || "Could not load more");
      }

      const nextTotal = typeof data.total === "number" ? data.total : totalRef.current;
      const seen = new Set(current.map((product) => product._id));
      const merged = [...current];

      for (const product of data.products ?? []) {
        if (!seen.has(product._id)) {
          seen.add(product._id);
          merged.push(product);
        }
      }

      // Stop automatic requests if an empty or duplicate batch makes no progress.
      autoLoadBlockedRef.current = merged.length === current.length;
      if (autoLoadBlockedRef.current && merged.length < nextTotal) {
        setError("Could not load additional products. Please try again.");
      }

      productsRef.current = merged;
      totalRef.current = nextTotal;
      setProducts(merged);
      setTotal(nextTotal);
    } catch (err) {
      autoLoadBlockedRef.current = true;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      requestInFlightRef.current = false;
      setLoadingCount(0);
    }
  }, []);

  useEffect(() => {
    if (!columns || loading || !hasMore || autoLoadBlockedRef.current) return;

    const filledCount = Math.min(
      total,
      Math.ceil(Math.max(pageSize, products.length) / columns) * columns
    );
    if (filledCount > products.length) {
      void loadProducts(filledCount - products.length);
    }
  }, [columns, hasMore, loading, loadProducts, pageSize, products.length, total]);

  const loadMore = () => {
    if (requestInFlightRef.current) return;

    const rowSize = Math.max(columns, 1);
    const currentCount = productsRef.current.length;
    const filledCount = Math.ceil((currentCount + pageSize) / rowSize) * rowSize;
    autoLoadBlockedRef.current = false;
    return loadProducts(filledCount - currentCount);
  };

  return (
    <section className="bg-brand-background py-9 sm:py-11">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-brand-link">
              <Zap className="h-3.5 w-3.5" />
              Just added
            </div>

            <h2 className="text-[24px] font-black tracking-[-0.035em] text-brand-dark sm:text-[28px]">
              New Arrivals
            </h2>
          </div>

          {hasMore ? (
            <LoadingButton
              type="button"
              loading={loading}
              onClick={loadMore}
              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-black text-brand-link transition hover:text-brand-dark disabled:opacity-50"
            >
              View More
              <ArrowRight className="h-3.5 w-3.5" />
            </LoadingButton>
          ) : null}
        </div>

        {totalCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-10 text-center text-sm font-semibold text-black/40">
            No new arrivals at the moment.
          </div>
        ) : (
          <div
            ref={gridRef}
            className={`${gridStyles.grid} ${styles.grid}`}
            aria-busy={loading}
          >
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                ribbon="NEW"
                badgePosition="right"
                variant="marketplace"
              />
            ))}

            {Array.from({ length: loadingCount }).map((_, index) => (
              <ProductCardSkeleton
                key={`new-loading-${index}`}
                variant="marketplace"
              />
            ))}
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
