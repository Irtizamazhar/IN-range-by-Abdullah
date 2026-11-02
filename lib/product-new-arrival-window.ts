/** Homepage bucket: Prisma products newer than this many days show under “New Arrivals”; older under “Featured”. */
export const NEW_ARRIVAL_WINDOW_DAYS = 14;

const MS_PER_DAY = 86_400_000;

/** Start of the time window: products with `createdAt >=` this value are treated as “new” on the homepage. */
export function newArrivalsWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY);
}

/** When a product leaves New Arrivals and becomes eligible for the homepage All Products section. */
export function newArrivalsWindowEnd(createdAt: Date): Date {
  return new Date(createdAt.getTime() + NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY);
}

/** Countdown through the 14-day New Arrivals period, to the hour. */
export function newArrivalsProgress(createdAt: Date, now: Date = new Date()) {
  const total = NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY;
  const end = newArrivalsWindowEnd(createdAt).getTime();
  const msLeft = Math.max(0, end - now.getTime());
  const hoursLeft = Math.ceil(msLeft / 3_600_000);
  return {
    // Same boundary as isProductInNewArrivalsWindow: still new at exactly 336 hours.
    ended: now.getTime() > end,
    daysLeft: Math.floor(hoursLeft / 24),
    hoursLeft: hoursLeft % 24,
    elapsedPct: Math.min(100, Math.max(0, Math.floor(((total - msLeft) / total) * 100))),
  };
}

export function isProductInNewArrivalsWindow(
  createdAt: Date,
  now: Date = new Date()
): boolean {
  return createdAt >= newArrivalsWindowStart(now);
}
