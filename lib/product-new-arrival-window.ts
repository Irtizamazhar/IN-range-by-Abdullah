/** Homepage bucket: Prisma products newer than this many days show under “New Arrivals”; older under “Featured”. */
export const NEW_ARRIVAL_WINDOW_DAYS = 14;

const MS_PER_DAY = 86_400_000;

/** Start of the time window: products with `createdAt >=` this value are treated as “new” on the homepage. */
export function newArrivalsWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY);
}

export function isProductInNewArrivalsWindow(
  createdAt: Date,
  now: Date = new Date()
): boolean {
  return createdAt >= newArrivalsWindowStart(now);
}
