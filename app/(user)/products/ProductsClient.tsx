"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard, ProductCardSkeleton } from "@/components/user/ProductCard";
import type { ProductCardData } from "@/components/user/ProductCard";

const PAGE_SIZE = 12;

function normalizeProducts(raw: unknown[]): ProductCardData[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const p = item as ProductCardData & { _id?: unknown; id?: unknown };
    const rc = Number(p.reviewCount);
    const ra = Number(p.ratingAvg);
    return {
      ...p,
      _id: String(p._id ?? p.id ?? ""),
      reviewCount: Number.isFinite(rc) ? rc : 0,
      ratingAvg: Number.isFinite(ra) ? ra : 0,
    };
  });
}

export function ProductsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const search = searchParams?.get("search") || "";
  const catRaw = searchParams?.get("category");
  const category =
    catRaw === null || catRaw === "" ? "" : catRaw || "";
  const sort = searchParams?.get("sort") || "newest";

  const filterKey = `${search}\0${category}\0${sort}`;

  const fetchPage = useCallback(
    async (pageNum: number) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      params.set("sort", sort);
      params.set("page", String(pageNum));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      const batch = normalizeProducts(data.products || []);
      return {
        batch,
        totalPages: Math.max(1, Number(data.totalPages) || 1),
      };
    },
    [search, category, sort]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPage(1);
      try {
        const { batch, totalPages: tp } = await fetchPage(1);
        if (cancelled) return;
        setProducts(batch);
        setTotalPages(tp);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterKey, fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || page >= totalPages) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const { batch, totalPages: tp } = await fetchPage(next);
      setTotalPages(tp);
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
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loading, loadingMore, page, totalPages]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((data: Array<{ name?: string }>) => {
        const names = Array.isArray(data)
          ? data
              .map((x) => String(x?.name || "").trim())
              .filter(Boolean)
          : [];
        setCategoryOptions(names);
      })
      .catch(() => {
        setCategoryOptions([]);
      });
  }, []);

  function buildQuery(patch: Partial<{ cat: string; sort: string }>) {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    const cat = patch.cat !== undefined ? patch.cat : category;
    if (cat) p.set("category", cat);
    p.set("sort", patch.sort !== undefined ? patch.sort : sort);
    return p.toString();
  }

  const unknownCategory =
    category && !categoryOptions.includes(category) ? category : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-darkText mb-6">
        All Products
      </h1>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 mb-6 lg:hidden">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="category-mobile" className="block font-bold text-darkText mb-2 text-sm">
            Category
          </label>
          <select
            id="category-mobile"
            value={unknownCategory ? category : category || ""}
            onChange={(e) => {
              const v = e.target.value;
              router.push(`/products?${buildQuery({ cat: v })}`);
            }}
            className="w-full rounded-xl border border-borderGray bg-white px-3 py-2.5 text-sm text-darkText shadow-sm focus:border-primaryBlue focus:outline-none focus:ring-2 focus:ring-primaryBlue/20"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {unknownCategory ? (
              <option value={unknownCategory}>{unknownCategory}</option>
            ) : null}
          </select>
        </div>
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="sort-mobile" className="block font-bold text-darkText mb-2 text-sm">
            Sort
          </label>
          <select
            id="sort-mobile"
            value={sort}
            onChange={(e) => {
              const v = e.target.value;
              router.push(`/products?${buildQuery({ sort: v })}`);
            }}
            className="w-full rounded-xl border border-borderGray bg-white px-3 py-2.5 text-sm text-darkText shadow-sm focus:border-primaryBlue focus:outline-none focus:ring-2 focus:ring-primaryBlue/20"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="hidden lg:block lg:w-56 shrink-0 space-y-6">
          <div>
            <label htmlFor="category-desktop" className="font-bold text-darkText mb-2 block">
              Category
            </label>
            <select
              id="category-desktop"
              value={unknownCategory ? category : category || ""}
              onChange={(e) => {
                const v = e.target.value;
                router.push(`/products?${buildQuery({ cat: v })}`);
              }}
              className="w-full rounded-xl border border-borderGray bg-white px-3 py-2.5 text-sm text-darkText shadow-sm focus:border-primaryBlue focus:outline-none focus:ring-2 focus:ring-primaryBlue/20"
            >
              <option value="">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {unknownCategory ? (
                <option value={unknownCategory}>{unknownCategory}</option>
              ) : null}
            </select>
          </div>
          <div>
            <label htmlFor="sort-desktop" className="font-bold text-darkText mb-2 block">
              Sort
            </label>
            <select
              id="sort-desktop"
              value={sort}
              onChange={(e) => {
                const v = e.target.value;
                router.push(`/products?${buildQuery({ sort: v })}`);
              }}
              className="w-full rounded-xl border border-borderGray bg-white px-3 py-2.5 text-sm text-darkText shadow-sm focus:border-primaryBlue focus:outline-none focus:ring-2 focus:ring-primaryBlue/20"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
          {!loading && products.length === 0 ? (
            <p className="text-center text-darkText/60 py-12">No products found.</p>
          ) : null}
          {!loading && page < totalPages ? (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="inline-flex min-w-[140px] justify-center rounded-xl border-2 border-primaryBlue bg-white px-10 py-3 font-bold text-primaryBlue shadow-sm transition-colors hover:bg-primaryBlue hover:text-white disabled:pointer-events-none disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "More"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
