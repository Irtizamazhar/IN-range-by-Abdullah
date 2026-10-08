"use client";
import { PostWantButton } from "@/components/user/PostWantButton";
import { usePageLoading } from "@/hooks/usePageLoading";
import { LoadingButton } from "@/components/ui/LoadingButton";

import Link from "@/components/ui/LoadingLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ChevronRight, LoaderCircle, PackageSearch, RotateCcw, SlidersHorizontal, Truck, X } from "lucide-react";
import { ProductCard, ProductCardSkeleton, type ProductCardData } from "@/components/user/ProductCard";
import { ProductFilters } from "./ProductFilters";
import { catalogQueryKey, readCatalogFilters, SORT_LABELS, updateCatalogQuery, type CatalogFilters } from "./catalog-filter-state";
import { formatPKR } from "@/lib/format";
import styles from "./Products.module.css";

const PAGE_SIZE = 18;
function normalizeProducts(raw: unknown): ProductCardData[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const p = item as ProductCardData & { id?: unknown };
    return { ...p, _id: String(p._id ?? p.id ?? ""), reviewCount: Number(p.reviewCount) || 0, ratingAvg: Number(p.ratingAvg) || 0 };
  });
}

export function ProductsClient() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  usePageLoading(loading);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filterReset, setFilterReset] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const request = useRef<AbortController | null>(null);
  const pendingFilters = useRef<Array<() => void>>([]);
  const fetchingMore = useRef(false);
  const loadMoreTrigger = useRef<HTMLDivElement>(null);

  const search = searchParams?.get("search") || "";
  const filters = readCatalogFilters(searchParams ?? new URLSearchParams());
  const { category, sort, minPrice, maxPrice, inStock } = filters;
  const filterCount = Number(Boolean(category)) + Number(minPrice !== null || maxPrice !== null) + Number(inStock) + Number(sort !== "newest");
  const hasFilters = filterCount > 0;
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (category) query.set("category", category);
  if (minPrice !== null) query.set("minPrice", String(minPrice));
  if (maxPrice !== null) query.set("maxPrice", String(maxPrice));
  if (inStock) query.set("inStock", "true");
  query.set("sort", sort);
  const filterKey = query.toString();

  const fetchPage = useCallback(async (pageNum: number, signal: AbortSignal) => {
    const params = new URLSearchParams(filterKey);
    params.set("page", String(pageNum));
    params.set("limit", String(PAGE_SIZE));
    const res = await fetch(`/api/products?${params}`, { signal });
    if (!res.ok) throw new Error("Could not load products");
    const data = await res.json();
    return { batch: normalizeProducts(data.products), total: Math.max(0, Number(data.total) || 0), totalPages: Math.max(1, Number(data.totalPages) || 1), priceRange: data.priceRange as { min: number; max: number } | undefined };
  }, [filterKey]);

  useEffect(() => {
    if (catalogQueryKey(new URLSearchParams(window.location.search)) !== catalogQueryKey(new URLSearchParams(filterKey))) return;
    const controller = new AbortController();
    request.current = controller;
    // Block queued scroll callbacks while the first page for these filters loads.
    fetchingMore.current = true;
    setLoading(true); setLoadingMore(false); setMoreError(""); setPage(1);
    void fetchPage(1, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setProducts(data.batch); setTotal(data.total); setTotalPages(data.totalPages); setError("");
      if (data.priceRange && Number.isFinite(data.priceRange.max)) setPriceRange(data.priceRange);
    }).catch(() => {
      if (!controller.signal.aborted) { setProducts([]); setError("We couldn't load the collection."); }
    }).finally(() => {
      if (!controller.signal.aborted) {
        fetchingMore.current = false; setLoading(false);
        pendingFilters.current.splice(0).forEach(resolve => resolve());
      }
    });
    return () => controller.abort();
  }, [fetchPage, filterKey, retry]);

  useEffect(() => () => { pendingFilters.current.splice(0).forEach(resolve => resolve()); }, []);

  function retryProducts() {
    const operation = new Promise<void>(resolve => pendingFilters.current.push(resolve));
    setRetry(previous => previous + 1);
    return operation;
  }

  const loadMore = useCallback(async () => {
    const controller = request.current;
    if (!controller || controller.signal.aborted || fetchingMore.current || loading || page >= totalPages) return;
    if (catalogQueryKey(new URLSearchParams(window.location.search)) !== catalogQueryKey(new URLSearchParams(filterKey))) return;
    fetchingMore.current = true; setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1, controller.signal);
      if (controller.signal.aborted) return;
      setProducts((previous) => {
        const seen = new Set(previous.map((product) => product._id));
        return [...previous, ...data.batch.filter((product) => !seen.has(product._id))];
      });
      setTotalPages(data.totalPages); setTotal(data.total); setPage((previous) => previous + 1); setMoreError("");
    } catch {
      if (!controller.signal.aborted) setMoreError("Couldn't load more products. Please try again.");
    } finally {
      if (!controller.signal.aborted) { fetchingMore.current = false; setLoadingMore(false); }
    }
  }, [fetchPage, filterKey, loading, page, totalPages]);

  useEffect(() => {
    const trigger = loadMoreTrigger.current;
    if (!trigger || loading || loadingMore || error || moreError || page >= totalPages) return;
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (active && entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "0px 0px 300px 0px" });
    observer.observe(trigger);
    return () => { active = false; observer.disconnect(); };
  }, [error, loadMore, loading, loadingMore, moreError, page, totalPages]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/categories", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("Could not load categories");
      return response.json();
    }).then((data: Array<{ name?: string }>) => {
      setCategoryOptions(Array.isArray(data) ? data.map((item) => String(item.name || "").trim()).filter(Boolean) : []);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const resetDrafts = () => setFilterReset((previous) => previous + 1);
    window.addEventListener("popstate", resetDrafts);
    return () => window.removeEventListener("popstate", resetDrafts);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (desktop.matches) drawer.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => { document.body.style.overflow = previousOverflow; desktop.removeEventListener("change", closeOnDesktop); };
  }, [drawerOpen]);

  function applyFilters(patch: Partial<CatalogFilters>) {
    return updateUrl(updateCatalogQuery(window.location.search, patch));
  }
  function updateUrl(params: URLSearchParams) {
    const current = new URLSearchParams(window.location.search);
    let operation: Promise<void> | undefined;
    if (catalogQueryKey(params) !== catalogQueryKey(current)) {
      operation = new Promise<void>(resolve => pendingFilters.current.push(resolve));
      request.current?.abort();
      setLoading(true);
      setLoadingMore(false);
      // Also refetch if two rapid edits return to the original query before React renders.
      setRetry((previous) => previous + 1);
    }
    // Next's native history integration updates useSearchParams without a route reload.
    window.history.replaceState(null, "", `/products${params.size ? `?${params}` : ""}${window.location.hash}`);
    return operation;
  }
  function clearFilters() {
    setFilterReset((previous) => previous + 1);
    return applyFilters({ category: "", sort: "newest", minPrice: null, maxPrice: null, inStock: false });
  }
  function browseAll() { setFilterReset((previous) => previous + 1); return updateUrl(new URLSearchParams()); }
  const formProps = { filters, categories: categoryOptions, priceRange, onApply: applyFilters, resetSignal: filterReset };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/">Home</Link><ChevronRight aria-hidden="true" /><span aria-current="page">All Products</span></nav>
        <header className={styles.heading}>
          <div><div className={styles.titleRow}><h1>All Products</h1>{!loading && !error && <span className={styles.count}>{total.toLocaleString("en-PK")} products</span>}</div><p>Everyday finds. A little more extraordinary.</p></div>
          <span className={styles.delivery}><Truck aria-hidden="true" /> Delivered across Pakistan</span>
        </header>
        <div className={styles.layout}>
          <aside aria-label="Product filters" className={styles.sidebar}>
            <div className={styles.filterHeading}><h2><SlidersHorizontal aria-hidden="true" /> Filters {hasFilters && <span className={styles.filterCount} aria-label={`${filterCount} active filters`}>{filterCount}</span>}</h2>{hasFilters && <LoadingButton type="button" onClick={clearFilters}>Clear all</LoadingButton>}</div>
            <ProductFilters {...formProps} id="desktop" />
          </aside>
          <section aria-labelledby="products-collection-title" className={styles.results}>
            <div className={styles.toolbar}>
              <div className={styles.collectionHeading}>
                <h2 id="products-collection-title">Just For You</h2>
                <p role="status" aria-live="polite">{loading ? <><LoaderCircle aria-hidden="true" className={styles.filterSpinner} /> Updating products…</> : error ? "Collection unavailable" : <>Showing <strong>{products.length ? `1–${products.length}` : "0"}</strong> of <strong>{total.toLocaleString("en-PK")}</strong> products</>}{search && <span className={styles.searchTerm}> for “{search}”</span>}</p>
              </div>
              <span className={styles.sortLabel}>{SORT_LABELS[sort]}</span>
              <LoadingButton ref={filterTrigger} type="button" className={styles.mobileFilter} aria-haspopup="dialog" aria-controls="product-filter-drawer" onClick={() => { drawer.current?.showModal(); setDrawerOpen(true); }}><SlidersHorizontal aria-hidden="true" /> Filter & sort {filterCount > 0 && <span>{filterCount}</span>}</LoadingButton>
            </div>
            {hasFilters && <div className={styles.chips} aria-label="Active filters">
              <span className={styles.activeFilterCount}>{filterCount} active {filterCount === 1 ? "filter" : "filters"}</span>
              {category && <LoadingButton type="button" onClick={() => applyFilters({ category: "" })}>{category}<X aria-label="Remove category filter" /></LoadingButton>}
              {(minPrice !== null || maxPrice !== null) && <LoadingButton type="button" onClick={() => applyFilters({ minPrice: null, maxPrice: null })}>{minPrice !== null && maxPrice !== null ? `${formatPKR(minPrice)} – ${formatPKR(maxPrice)}` : minPrice !== null ? `From ${formatPKR(minPrice)}` : `Up to ${formatPKR(maxPrice!)}`}<X aria-label="Remove price filter" /></LoadingButton>}
              {inStock && <LoadingButton type="button" onClick={() => applyFilters({ inStock: false })}>In stock<X aria-label="Remove stock filter" /></LoadingButton>}
              {sort !== "newest" && <LoadingButton type="button" onClick={() => applyFilters({ sort: "newest" })}>{SORT_LABELS[sort]}<X aria-label="Remove sort filter" /></LoadingButton>}
              <LoadingButton type="button" className={styles.clearAll} onClick={clearFilters}>Clear all filters</LoadingButton>
            </div>}
            <div className={styles.grid} aria-busy={loading || loadingMore}>
              {loading ? Array.from({ length: PAGE_SIZE }, (_, index) => <ProductCardSkeleton key={index} variant="marketplace" />) : products.map((product) => <ProductCard key={product._id} product={product} variant="marketplace" />)}
              {loadingMore && Array.from({ length: 6 }, (_, index) => <ProductCardSkeleton key={`more-${index}`} variant="marketplace" />)}
            </div>
            {(error || (!loading && products.length === 0)) && <div className={styles.empty}>
              <div className={styles.emptyIcon}><PackageSearch aria-hidden="true" /></div>
              <h2>{error || "No matches just yet"}</h2>
              <p>{error ? "Please check your connection and give it another try." : "Try a different category or a wider price range. Your next great find could be one filter away."}</p>
              {error ? <LoadingButton type="button" className={styles.primaryButton} onClick={retryProducts}><RotateCcw aria-hidden="true" /> Try again</LoadingButton> : <><LoadingButton type="button" className={styles.primaryButton} onClick={browseAll}>Browse all products <ArrowRight aria-hidden="true" /></LoadingButton><PostWantButton initialTitle={search} className={styles.wantLink}>Looking for something specific? Post a Want</PostWantButton></>}
            </div>}
            {!loading && !error && products.length > 0 && <div ref={loadMoreTrigger} className={styles.pagination}>
              <p>You’ve explored {products.length} of {total.toLocaleString("en-PK")} products</p>
              <div className={styles.progress} aria-hidden="true"><span style={{ width: `${Math.min(100, products.length / Math.max(1, total) * 100)}%` }} /></div>
              {moreError && <p role="alert">{moreError}</p>}
              {page < totalPages && (moreError
                ? <LoadingButton type="button" className={styles.retryMore} onClick={() => loadMore()}><RotateCcw aria-hidden="true" /> Try again</LoadingButton>
                : <p role="status" className={styles.scrollStatus}>{loadingMore ? <><LoaderCircle aria-hidden="true" className={styles.filterSpinner} /> Loading more products…</> : "Scroll to discover more"}</p>)}
            </div>}
          </section>
        </div>
      </div>
      <dialog ref={drawer} id="product-filter-drawer" aria-labelledby="filter-drawer-title" className={styles.drawer} onClose={() => { setDrawerOpen(false); filterTrigger.current?.focus({ preventScroll: true }); }} onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
        <div className={styles.drawerContent}>
          <div className={styles.drawerHeading}><div><span>MAKE IT YOURS</span><h2 id="filter-drawer-title">Filter & sort</h2></div><LoadingButton type="button" aria-label="Close filters" onClick={() => drawer.current?.close()}><X aria-hidden="true" /></LoadingButton></div>
          <p className={styles.drawerStatus} role="status">{loading ? <><LoaderCircle className={styles.filterSpinner} aria-hidden="true" /> Updating products…</> : `${total.toLocaleString("en-PK")} products · ${filterCount} active filters`}</p>
          <ProductFilters {...formProps} id="mobile" />
          {hasFilters && <LoadingButton type="button" className={styles.drawerReset} onClick={clearFilters}>Clear all filters</LoadingButton>}
        </div>
      </dialog>
    </div>
  );
}
