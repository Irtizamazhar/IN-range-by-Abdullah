export function shouldShowCustomerWelcome(eligibleAt: Date | null, seenAt: Date | null): boolean {
  return Boolean(eligibleAt && !seenAt);
}
