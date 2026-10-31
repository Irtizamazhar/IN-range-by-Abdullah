/** Google sign-in returns through this route, which sends a brand-new customer to the home page welcome. */
export function afterGoogleSignInUrl(next: string): string {
  return `/api/customer/after-google?next=${encodeURIComponent(next || "/")}`;
}

export function shouldShowCustomerWelcome(eligibleAt: Date | null, seenAt: Date | null): boolean {
  return Boolean(eligibleAt && !seenAt);
}
