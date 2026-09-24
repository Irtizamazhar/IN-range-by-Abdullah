import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXTAUTH_SECRET = "test-secret-for-password-reauth";

import {
  createPasswordReauthIntent,
  hasLocalPassword,
  verifyPasswordReauthIntent,
  CUSTOMER_PASSWORD_REAUTH_MAX_AGE_SECONDS,
  OAUTH_PLACEHOLDER_HASH,
} from "../lib/customer-password-security";

test("password reauth intent is signed and expires", () => {
  const issuedAt = Date.now();
  const token = createPasswordReauthIntent("customer-1");
  assert.equal(verifyPasswordReauthIntent(token, issuedAt + 1)?.customerId, "customer-1");
  assert.equal(verifyPasswordReauthIntent(token, issuedAt + CUSTOMER_PASSWORD_REAUTH_MAX_AGE_SECONDS * 1000 + 1), null);
  assert.equal(verifyPasswordReauthIntent(`${token}tampered`, issuedAt + 1), null);
});

test("OAuth-only hashes are not treated as local passwords", () => {
  assert.equal(hasLocalPassword(OAUTH_PLACEHOLDER_HASH), false);
  assert.equal(hasLocalPassword("oauth-only:random-value"), false);
  assert.equal(hasLocalPassword("$2b$12$valid-looking-local-hash"), true);
});