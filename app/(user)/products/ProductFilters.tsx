"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { ProductFilterSelect } from "@/components/user/ProductFilterSelect";
import { formatPKR } from "@/lib/format";
import styles from "./Products.module.css";
import { createPriceDebouncer, normalizePriceDraft, type CatalogFilters, type PriceDraft } from "./catalog-filter-state";

export function ProductFilters({ filters, categories, priceRange, onApply, id, resetSignal }: {
  filters: CatalogFilters;
  categories: string[];
  priceRange: { min: number; max: number } | null;
  onApply: (filters: Partial<CatalogFilters>) => void;
  id: string;
  resetSignal: number;
}) {
  const ceiling = Math.max(100, Math.ceil((priceRange?.max || 0) / 100) * 100, filters.maxPrice || 0, filters.minPrice || 0);
  const [draft, setDraft] = useState<PriceDraft>({ minimum: String(filters.minPrice ?? 0), maximum: filters.maxPrice === null ? null : String(filters.maxPrice) });
  const draftRef = useRef(draft);
  const draftRevision = useRef(0);
  const submittedRevisions = useRef(new Map<string, number>());
  const lastReset = useRef(resetSignal);
  const latest = useRef({ onApply, ceiling });
  latest.current = { onApply, ceiling };
  const [debounced] = useState(() => createPriceDebouncer(applyDraft));
  const normalized = normalizePriceDraft(draft, ceiling);
  const lower = normalized.minPrice ?? 0;
  const upper = normalized.maxPrice ?? ceiling;

  useEffect(() => {
    // External resets/back navigation update both forms; sort/stock changes preserve pending typing.
    const key = JSON.stringify([filters.minPrice, filters.maxPrice]);
    const submittedRevision = submittedRevisions.current.get(key);
    submittedRevisions.current.delete(key);
    if (lastReset.current === resetSignal && submittedRevision !== undefined && draftRevision.current > submittedRevision) return;
    lastReset.current = resetSignal;
    submittedRevisions.current.clear();
    debounced.cancel();
    const value = { minimum: String(filters.minPrice ?? 0), maximum: filters.maxPrice === null ? null : String(filters.maxPrice) };
    draftRef.current = value;
    setDraft(value);
  }, [filters.minPrice, filters.maxPrice, resetSignal, debounced]);

  useEffect(() => () => debounced.cancel(), [debounced]);

  function changeDraft(patch: Partial<PriceDraft>, debounce: boolean) {
    draftRevision.current += 1;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    if (debounce) debounced.schedule(next);
  }

  function applyDraft(value: PriceDraft) {
    const prices = normalizePriceDraft(value, latest.current.ceiling);
    submittedRevisions.current.set(JSON.stringify([prices.minPrice, prices.maxPrice]), draftRevision.current);
    const normalizedDraft = { minimum: String(prices.minPrice ?? 0), maximum: prices.maxPrice === null ? null : String(prices.maxPrice) };
    draftRef.current = normalizedDraft;
    setDraft(normalizedDraft);
    latest.current.onApply(prices);
  }

  function commitSlider() {
    debounced.cancel();
    applyDraft(draftRef.current);
  }

  const sliderEvents = {
    onPointerDown: (event: React.PointerEvent<HTMLInputElement>) => {
      debounced.cancel();
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerUp: commitSlider,
    onPointerCancel: commitSlider,
    onKeyDown: () => debounced.cancel(),
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) commitSlider();
    },
    onBlur: commitSlider,
  };
  // Logarithmic positions keep everyday budgets usable alongside expensive products.
  const position = (amount: number) => Math.log1p(amount) / Math.log1p(ceiling) * 100;
  const amount = (value: number) => Math.round(Math.expm1(value / 100 * Math.log1p(ceiling)));
  const categoryNames = Array.from(new Set([...categories, ...(filters.category ? [filters.category] : [])]));
  return <div className={styles.filterForm}>
    <details className={styles.filterSection} open>
      <summary><span>Category</span><ChevronDown aria-hidden="true" /></summary>
      <div className={styles.filterSectionBody}>
        <label id={`category-${id}-label`} htmlFor={`category-${id}`} className="sr-only">Category</label>
        <ProductFilterSelect id={`category-${id}`} value={filters.category} options={[{ value: "", label: "All categories" }, ...categoryNames.map((name) => ({ value: name, label: name }))]} onChange={(category) => onApply({ category })} />
      </div>
    </details>
    <details className={styles.filterSection} open>
      <summary><span>Price range <small>PKR</small></span><ChevronDown aria-hidden="true" /></summary>
      <div className={styles.filterSectionBody}>
        <div className={styles.priceFields}>
          <label htmlFor={`min-price-${id}`}><span>Min price</span><div><span>Rs.</span><input id={`min-price-${id}`} type="number" min="0" max={ceiling} step="any" inputMode="decimal" disabled={!priceRange} value={draft.minimum} onChange={(event) => changeDraft({ minimum: event.target.value }, true)} /></div></label>
          <span aria-hidden="true">–</span>
          <label htmlFor={`max-price-${id}`}><span>Max price</span><div><span>Rs.</span><input id={`max-price-${id}`} type="number" min={lower} max={ceiling} step="any" inputMode="decimal" disabled={!priceRange} value={draft.maximum ?? String(ceiling)} onChange={(event) => changeDraft({ maximum: event.target.value }, true)} /></div></label>
        </div>
        <div className={styles.range} style={{ "--range-min": `${position(lower)}%`, "--range-max": `${position(upper)}%` } as CSSProperties}>
          <div className={styles.rangeTrack} />
          <input {...sliderEvents} type="range" min="0" max="100" step="0.1" disabled={!priceRange} style={{ zIndex: position(lower) > 50 ? 3 : 1 }} value={position(lower)} aria-label="Minimum price" aria-valuetext={formatPKR(lower)} onChange={(event) => changeDraft({ minimum: String(Math.min(upper, amount(Number(event.target.value)))) }, false)} />
          <input {...sliderEvents} type="range" min="0" max="100" step="0.1" disabled={!priceRange} style={{ zIndex: 2 }} value={position(upper)} aria-label="Maximum price" aria-valuetext={formatPKR(upper)} onChange={(event) => changeDraft({ maximum: String(Math.max(lower, amount(Number(event.target.value)))) }, false)} />
        </div>
        <p className={styles.priceHint}>{priceRange ? "A little room for every budget." : "Loading catalog prices…"}</p>
      </div>
    </details>
    <details className={styles.filterSection} open>
      <summary><span>Sort by</span><ChevronDown aria-hidden="true" /></summary>
      <div className={styles.filterSectionBody}>
        <label id={`sort-${id}-label`} htmlFor={`sort-${id}`} className="sr-only">Sort by</label>
        <ProductFilterSelect id={`sort-${id}`} value={filters.sort} options={[{ value: "newest", label: "Newest arrivals" }, { value: "price_asc", label: "Price: Low to High" }, { value: "price_desc", label: "Price: High to Low" }]} onChange={(sort) => onApply({ sort })} />
      </div>
    </details>
    <details className={styles.filterSection} open>
      <summary><span>Availability</span><ChevronDown aria-hidden="true" /></summary>
      <div className={styles.filterSectionBody}>
        <label className={styles.stockToggle}><span><strong>In stock only</strong><small>Ready to add to your cart</small></span><input type="checkbox" role="switch" checked={filters.inStock} onChange={(event) => onApply({ inStock: event.target.checked })} /><span className={styles.switchTrack} aria-hidden="true" /></label>
      </div>
    </details>
  </div>;
}
