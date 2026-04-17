/**
 * When `VENDOR_REQUIRE_EMAIL_VERIFICATION` is exactly `"true"`, new vendors must
 * verify email before login (while still pending). Otherwise signup marks email as
 * verified and no link is required — use until transactional email is configured.
 */
export function vendorEmailVerificationRequired(): boolean {
  return process.env.VENDOR_REQUIRE_EMAIL_VERIFICATION === "true";
}
