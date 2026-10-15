export const CUSTOMER_REMEMBERED_SECONDS = 30 * 24 * 60 * 60;
export const CUSTOMER_BROWSER_SESSION_SECONDS = 12 * 60 * 60;
export const CUSTOMER_OAUTH_REMEMBER_COOKIE = "joro_customer_oauth_remember";

/** This cookie contains only the pending OAuth preference, never a credential. */
export function setCustomerOAuthRememberChoice(remember: boolean): void {
  document.cookie = `${CUSTOMER_OAUTH_REMEMBER_COOKIE}=${remember ? "1" : "0"}; Path=/api/auth; Max-Age=600; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function customerTokenLifetime(remember: boolean | undefined): number {
  // Existing tokens predate the checkbox and retain their prior 30-day policy.
  return remember === false ? CUSTOMER_BROWSER_SESSION_SECONDS : CUSTOMER_REMEMBERED_SECONDS;
}
