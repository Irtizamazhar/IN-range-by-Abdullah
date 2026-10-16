/**
 * Service commission price ranges: pure validation + matching shared by the admin UI and the
 * server. Amounts are compared in whole paisa (cents) and rates in basis points so that
 * Decimal(12,2) / Decimal(5,2) values from MySQL never drift through float arithmetic.
 */

export type ServiceCommissionRangeInput = {
  minAmount: number;
  maxAmount: number;
  commissionPercentage: number;
  isActive: boolean;
};

/** Initial, admin-editable defaults (also seeded once by the migration). Not enforced rules. */
export const DEFAULT_SERVICE_COMMISSION_RANGES: ServiceCommissionRangeInput[] = [
  { minAmount: 500, maxAmount: 1000, commissionPercentage: 15, isActive: true },
  { minAmount: 1001, maxAmount: 2000, commissionPercentage: 12, isActive: true },
  { minAmount: 2001, maxAmount: 5000, commissionPercentage: 10, isActive: true },
  { minAmount: 5001, maxAmount: 10000, commissionPercentage: 8, isActive: true },
  { minAmount: 10001, maxAmount: 50000, commissionPercentage: 6, isActive: true },
  { minAmount: 50001, maxAmount: 100000, commissionPercentage: 5, isActive: true },
];

export const MAX_SERVICE_COMMISSION_RANGES = 100;
export const MAX_SERVICE_AMOUNT = 9_999_999_999.99; // Decimal(12, 2)

/**
 * Adjacent active ranges at most this far apart (e.g. 1,000 → 1,001) are treated as contiguous:
 * an amount strictly between them (e.g. 1,000.50) uses the lower range.
 */
export const CONTIGUOUS_GAP_CENTS = 100;

export const toCents = (value: number | string) => Math.round(Number(value) * 100);
const toBasisPoints = (value: number | string) => Math.round(Number(value) * 100);

function hasAtMostTwoDecimals(value: number) {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

export type RangeFieldErrors = Partial<Record<"minAmount" | "maxAmount" | "commissionPercentage" | "range", string>>;

export type RangeValidationResult = {
  /** Same order as the input; empty object for valid rows. */
  rowErrors: RangeFieldErrors[];
  /** Blocking problems that are not tied to a single field. */
  errors: string[];
  /** Non-blocking advice (gaps between active ranges). */
  warnings: string[];
  valid: boolean;
};

const formatPKR = (cents: number) =>
  `PKR ${(cents / 100).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function validateServiceCommissionRanges(ranges: ServiceCommissionRangeInput[]): RangeValidationResult {
  const rowErrors: RangeFieldErrors[] = ranges.map(() => ({}));
  const errors: string[] = [];
  const warnings: string[] = [];

  if (ranges.length > MAX_SERVICE_COMMISSION_RANGES) {
    errors.push(`At most ${MAX_SERVICE_COMMISSION_RANGES} ranges are allowed.`);
  }

  ranges.forEach((range, i) => {
    const e = rowErrors[i]!;
    const { minAmount, maxAmount, commissionPercentage } = range;
    if (!Number.isFinite(minAmount)) e.minAmount = "Enter a minimum amount.";
    else if (minAmount < 0) e.minAmount = "Minimum must be 0 or more.";
    else if (minAmount > MAX_SERVICE_AMOUNT || !hasAtMostTwoDecimals(minAmount)) e.minAmount = "Use a valid PKR amount (max 2 decimals).";
    if (!Number.isFinite(maxAmount)) e.maxAmount = "Enter a maximum amount.";
    else if (maxAmount > MAX_SERVICE_AMOUNT || !hasAtMostTwoDecimals(maxAmount)) e.maxAmount = "Use a valid PKR amount (max 2 decimals).";
    else if (Number.isFinite(minAmount) && maxAmount <= minAmount) e.maxAmount = "Maximum must be greater than minimum.";
    if (!Number.isFinite(commissionPercentage)) e.commissionPercentage = "Enter a rate.";
    else if (commissionPercentage < 0 || commissionPercentage > 100) e.commissionPercentage = "Rate must be 0–100%.";
    else if (!hasAtMostTwoDecimals(commissionPercentage)) e.commissionPercentage = "Use at most 2 decimals.";
  });

  const fieldValid = (i: number) => Object.keys(rowErrors[i]!).length === 0;

  // Duplicates (any status).
  const seen = new Map<string, number>();
  ranges.forEach((range, i) => {
    if (!fieldValid(i)) return;
    const key = `${toCents(range.minAmount)}-${toCents(range.maxAmount)}`;
    const first = seen.get(key);
    if (first != null) rowErrors[i]!.range = `Duplicate of range #${first + 1}.`;
    else seen.set(key, i);
  });

  // Overlaps and gaps (active ranges only; bounds are inclusive).
  const active = ranges
    .map((range, index) => ({ index, min: toCents(range.minAmount), max: toCents(range.maxAmount), active: range.isActive }))
    .filter((row) => row.active && fieldValid(row.index) && !rowErrors[row.index]!.range)
    .sort((a, b) => a.min - b.min || a.max - b.max);
  for (let i = 1; i < active.length; i++) {
    const prev = active[i - 1]!;
    const curr = active[i]!;
    if (curr.min <= prev.max) {
      rowErrors[curr.index]!.range = `Overlaps range #${prev.index + 1} (${formatPKR(prev.min)}–${formatPKR(prev.max)}).`;
    } else if (curr.min - prev.max > CONTIGUOUS_GAP_CENTS) {
      warnings.push(`No active range covers ${formatPKR(prev.max)} to ${formatPKR(curr.min)}; bookings in this gap will be refused.`);
    }
  }
  if (ranges.length > 0 && active.length === 0 && errors.length === 0) {
    warnings.push("No active ranges: every service booking will be refused until a range is active.");
  }

  const valid = errors.length === 0 && rowErrors.every((e) => Object.keys(e).length === 0);
  return { rowErrors, errors, warnings, valid };
}

/**
 * Finds the active range for an amount. Inclusive bounds; an amount inside a contiguous seam
 * (gap ≤ CONTIGUOUS_GAP_CENTS between two active ranges) uses the lower range. Returns null when
 * nothing matches — callers must refuse rather than guess a rate.
 */
export function findServiceCommissionRange<T extends { minAmount: number | string; maxAmount: number | string; isActive: boolean }>(
  ranges: T[],
  amount: number | string
): T | null {
  const amountCents = toCents(amount);
  const active = ranges
    .filter((r) => r.isActive)
    .map((r) => ({ range: r, min: toCents(r.minAmount), max: toCents(r.maxAmount) }))
    .sort((a, b) => a.min - b.min);
  for (let i = 0; i < active.length; i++) {
    const row = active[i]!;
    if (amountCents >= row.min && amountCents <= row.max) return row.range;
    const next = active[i + 1];
    if (next && amountCents > row.max && amountCents < next.min && next.min - row.max <= CONTIGUOUS_GAP_CENTS) return row.range;
  }
  return null;
}

/** Commission on an amount at a rate, rounded half-up to the paisa (display/examples). */
export function commissionCents(amountCents: number, percentage: number | string) {
  return Math.round((amountCents * toBasisPoints(percentage)) / 10_000);
}
