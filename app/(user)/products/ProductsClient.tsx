"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard, ProductCardSkeleton } from "@/components/user/ProductCard";
import type { ProductCardData } from "@/components/user/ProductCard";

import { ProductFilterSelect } from "@/components/user/ProductFilterSelect";

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
          <label id="category-mobile-label" htmlFor="category-mobile" className="block font-bold text-darkText mb-2 text-sm">
            Category
          </label>
          <ProductFilterSelect
              id="category-mobile"
              value={category}
              options={[
                { value: "", label: "All categories" },
                ...Array.from(new Set([...categoryOptions, ...(unknownCategory ? [unknownCategory] : [])])).map((name) => ({ value: name, label: name })),
              ]}
              onChange={(value) => router.push(`/products?${buildQuery({ cat: value })}`)}
            />
        </div>
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label id="sort-mobile-label" htmlFor="sort-mobile" className="block font-bold text-darkText mb-2 text-sm">
            Sort
          </label>
          <ProductFilterSelect
              id="sort-mobile"
              value={sort}
              options={[
                { value: "newest", label: "Newest" },
                { value: "price_asc", label: "Price: Low to High" },
                { value: "price_desc", label: "Price: High to Low" },
              ]}
              onChange={(value) => router.push(`/products?${buildQuery({ sort: value })}`)}
            />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="hidden lg:block lg:w-56 shrink-0 space-y-6">
          <div>
            <label id="category-desktop-label" htmlFor="category-desktop" className="font-bold text-darkText mb-2 block">
              Category
            </label>
            <ProductFilterSelect
              id="category-desktop"
              value={category}
              options={[
                { value: "", label: "All categories" },
                ...Array.from(new Set([...categoryOptions, ...(unknownCategory ? [unknownCategory] : [])])).map((name) => ({ value: name, label: name })),
              ]}
              onChange={(value) => router.push(`/products?${buildQuery({ cat: value })}`)}
            />
          </div>
          <div>
            <label id="sort-desktop-label" htmlFor="sort-desktop" className="font-bold text-darkText mb-2 block">
              Sort
            </label>
            <ProductFilterSelect
              id="sort-desktop"
              value={sort}
              options={[
                { value: "newest", label: "Newest" },
                { value: "price_asc", label: "Price: Low to High" },
                { value: "price_desc", label: "Price: High to Low" },
              ]}
              onChange={(value) => router.push(`/products?${buildQuery({ sort: value })}`)}
            />
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
            <div className="py-12 text-center"><p>No products found.</p><Link href={`/wants/new?title=${encodeURIComponent(search)}`} className="mt-4 inline-block rounded-xl bg-brand-primary p-3 font-bold">Post this as a Want</Link></div>
          ) : null}
          {!loading && page < totalPages ? (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="inline-flex min-w-[140px] justify-center rounded-xl border-2 border-primaryBlue bg-white px-10 py-3 font-bold text-primaryBlue shadow-sm transition-colors hover:bg-brand-primary hover:text-white disabled:pointer-events-none disabled:opacity-60"
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
