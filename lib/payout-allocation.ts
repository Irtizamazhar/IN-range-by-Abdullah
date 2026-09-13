export type AvailableEarning = { id: string; availableCents: number };
export type ExactAllocation = { earningId: string; amountCents: number };

/** FIFO split that never over-allocates the final earning. */
export function allocateExactCents(
  sources: readonly AvailableEarning[],
  requestedCents: number
): ExactAllocation[] {
  if (!Number.isSafeInteger(requestedCents) || requestedCents <= 0) {
    throw new Error("Withdrawal amount must be a positive cent value");
  }

  let remaining = requestedCents;
  const allocations: ExactAllocation[] = [];
  for (const source of sources) {
    if (remaining === 0) break;
    if (!Number.isSafeInteger(source.availableCents) || source.availableCents <= 0) {
      continue;
    }
    const amountCents = Math.min(source.availableCents, remaining);
    allocations.push({ earningId: source.id, amountCents });
    remaining -= amountCents;
  }
  if (remaining !== 0) {
    throw new Error("Insufficient available earnings to cover this withdrawal");
  }
  return allocations;
}

export function toCents(value: number | string): number {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Invalid monetary amount");
  return cents;
}

export function fromCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("Invalid cent value");
  return value / 100;
}
