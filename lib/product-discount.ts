export function computeDiscountPercent(
  price: number,
  original?: number | null
): number {
  if (original != null && original > price) {
    return Math.round((1 - price / original) * 100);
  }
  return 0;
}

/**
 * Discount safe to show on a card, derived from the two prices only (never a stored percentage).
 * Null unless 1–99%: no "0%", no "-100%" from implausible originals, nothing for missing or lower originals.
 */
export function displayDiscount(price: number, original?: number | null): { percent: number; original: number } | null {
  const now = Number(price), was = Number(original);
  if (!Number.isFinite(now) || now <= 0 || !Number.isFinite(was) || was <= now) return null;
  const percent = Math.round(((was - now) / was) * 100);
  return percent >= 1 && percent <= 99 ? { percent, original: was } : null;
}
