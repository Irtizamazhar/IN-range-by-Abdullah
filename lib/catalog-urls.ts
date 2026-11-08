export function slugBase(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150).replace(/-+$/g, "") || "product";
}
export function productPath(product: { id: string; slug?: string | null }): string {
  return "/products/" + encodeURIComponent(product.slug || product.id);
}
export function safeRedirectQuery(values: Record<string, string | string[] | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const key of ["page", "sort", "minPrice", "maxPrice", "inStock", "variant"]) {
    const value = values[key];
    if (typeof value === "string" && value.length <= 100 && /^[a-zA-Z0-9 ._-]+$/.test(value)) query.set(key, value);
  }
  return query.size ? "?" + query : "";
}
