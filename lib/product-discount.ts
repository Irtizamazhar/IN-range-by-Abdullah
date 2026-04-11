export function computeDiscountPercent(
  price: number,
  original?: number | null
): number {
  if (original != null && original > price) {
    return Math.round((1 - price / original) * 100);
  }
  return 0;
}
