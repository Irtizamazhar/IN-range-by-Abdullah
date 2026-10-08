export type CatalogFilters = {
  category: string;
  sort: string;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
};

export type PriceDraft = { minimum: string; maximum: string | null };

export const SORT_LABELS: Record<string, string> = {
  newest: "Newest arrivals",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

function priceParam(value: string | null) {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function readCatalogFilters(params: Pick<URLSearchParams, "get">): CatalogFilters {
  const sort = params.get("sort") || "newest";
  return {
    category: params.get("category") || "",
    sort: Object.prototype.hasOwnProperty.call(SORT_LABELS, sort) ? sort : "newest",
    minPrice: priceParam(params.get("minPrice")),
    maxPrice: priceParam(params.get("maxPrice")),
    inStock: params.get("inStock") === "true",
  };
}

export function catalogQueryKey(params: Pick<URLSearchParams, "get">) {
  return JSON.stringify([params.get("search") || "", readCatalogFilters(params)]);
}

/** Merge against the current URL so closely spaced changes cannot overwrite each other. */
export function updateCatalogQuery(search: string, patch: Partial<CatalogFilters>) {
  const params = new URLSearchParams(search);
  const next = { ...readCatalogFilters(params), ...patch };
  const values = {
    category: next.category || null,
    sort: next.sort === "newest" ? null : next.sort,
    minPrice: next.minPrice === null ? null : String(next.minPrice),
    maxPrice: next.maxPrice === null ? null : String(next.maxPrice),
    inStock: next.inStock ? "true" : null,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  params.delete("page");
  return params;
}

export function normalizePriceDraft(draft: PriceDraft, ceiling: number) {
  const bound = (value: string | null, fallback: number) => {
    const number = value?.trim() ? Number(value) : fallback;
    return Number.isFinite(number) ? Math.max(0, Math.min(ceiling, number)) : fallback;
  };
  const lower = bound(draft.minimum, 0);
  const upper = Math.max(lower, bound(draft.maximum, ceiling));
  return { minPrice: lower > 0 ? lower : null, maxPrice: upper < ceiling ? upper : null };
}

export function createPriceDebouncer(apply: (draft: PriceDraft) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel() { clearTimeout(timer); timer = undefined; }
  return {
    cancel,
    schedule(draft: PriceDraft) {
      cancel();
      const next = { ...draft };
      timer = setTimeout(() => { timer = undefined; apply(next); }, 500);
    },
  };
}
