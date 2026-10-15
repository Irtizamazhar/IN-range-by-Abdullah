import assert from "node:assert/strict";
import test from "node:test";
import { decode } from "next-auth/jwt";
import { customerAuthOptions } from "../lib/customer-auth-options";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "../lib/auth-cookies";
import { CUSTOMER_BROWSER_SESSION_SECONDS, CUSTOMER_REMEMBERED_SECONDS, customerTokenLifetime } from "../lib/customer-remember-policy";
import { applyCustomerCookiePersistence, browserSessionCookies, sessionTokenFromSetCookies } from "../lib/customer-session-cookie";
import { vendorLoginCookieLifetime } from "../lib/vendor-expires";

test("customer token lifetimes distinguish unchecked, checked, and legacy sessions", async () => {
  assert.equal(customerTokenLifetime(false), 12 * 60 * 60);
  assert.equal(customerTokenLifetime(true), 30 * 24 * 60 * 60);
  assert.equal(customerTokenLifetime(undefined), CUSTOMER_REMEMBERED_SECONDS);
  const secret = "remember-me-test-secret-with-sufficient-length";
  for (const [rememberMe, expected] of [[false, CUSTOMER_BROWSER_SESSION_SECONDS], [true, CUSTOMER_REMEMBERED_SECONDS]] as const) {
    const encoded = await customerAuthOptions.jwt!.encode!({ token: { sub: "customer-1", role: "customer", rememberMe }, secret, maxAge: CUSTOMER_REMEMBERED_SECONDS });
    const token = await decode({ token: encoded, secret });
    assert.equal(token?.rememberMe, rememberMe);
    assert.ok(Math.abs(Number(token?.exp) - Math.floor(Date.now() / 1000) - expected) <= 3);
  }
});

test("unchecked customer cookies become browser-session cookies without touching admin or vendor cookies", () => {
  const source = [
    `${CUSTOMER_SESSION_COOKIE}=token; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Fri, 13 Nov 2026 00:00:00 GMT`,
    `${ADMIN_SESSION_COOKIE}=admin; Path=/; HttpOnly; Expires=Fri, 13 Nov 2026 00:00:00 GMT`,
    "vendor_token=vendor; Path=/; HttpOnly; Max-Age=2592000",
    `${CUSTOMER_SESSION_COOKIE}.0=; Path=/; Max-Age=0`,
  ];
  assert.equal(sessionTokenFromSetCookies(source), "token");
  const output = browserSessionCookies(source);
  assert.doesNotMatch(output[0], /Expires|Max-Age/i);
  assert.match(output[0], /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(output[1], source[1]);
  assert.equal(output[2], source[2]);
  assert.equal(output[3], source[3]);
});

test("chunked customer tokens are reconstructed in number order", () => {
  const cookies = [
    `${CUSTOMER_SESSION_COOKIE}.1=second; Expires=Fri, 13 Nov 2026 00:00:00 GMT`,
    `${CUSTOMER_SESSION_COOKIE}.0=first; Expires=Fri, 13 Nov 2026 00:00:00 GMT`,
  ];
  assert.equal(sessionTokenFromSetCookies(cookies), "firstsecond");
  assert.ok(browserSessionCookies(cookies).every(cookie => !cookie.includes("Expires")));
});

test("actual signed response cookies use the selected persistence without changing admin cookies", async () => {
  const secret = "remember-me-test-secret-with-sufficient-length";
  for (const rememberMe of [false, true]) {
    const encoded = await customerAuthOptions.jwt!.encode!({ token: { sub: "customer-1", role: "customer", rememberMe }, secret, maxAge: CUSTOMER_REMEMBERED_SECONDS });
    const response = new Response("ok");
    response.headers.append("set-cookie", `${CUSTOMER_SESSION_COOKIE}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Expires=Fri, 13 Nov 2026 00:00:00 GMT`);
    response.headers.append("set-cookie", `${ADMIN_SESSION_COOKIE}=admin; Path=/; HttpOnly; Expires=Fri, 13 Nov 2026 00:00:00 GMT`);
    await applyCustomerCookiePersistence(response, secret);
    const cookies = response.headers.getSetCookie();
    const customer = cookies.find(cookie => cookie.startsWith(`${CUSTOMER_SESSION_COOKIE}=`));
    const admin = cookies.find(cookie => cookie.startsWith(`${ADMIN_SESSION_COOKIE}=`));
    assert.equal(customer?.includes("Expires="), rememberMe);
    assert.match(admin ?? "", /Expires=/);
  }
});

test("vendor unchecked cookie is session-only while checked cookie persists", () => {
  assert.deepEqual(vendorLoginCookieLifetime(false, 7 * 24 * 60 * 60), {});
  assert.deepEqual(vendorLoginCookieLifetime(true, 30 * 24 * 60 * 60), { maxAge: 30 * 24 * 60 * 60 });
});

test("logout cookie deletion remains intact", async () => {
  const source = `${CUSTOMER_SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`;
  const response = new Response("ok", { headers: { "set-cookie": source } });
  await applyCustomerCookiePersistence(response, "remember-me-test-secret-with-sufficient-length");
  assert.equal(response.headers.getSetCookie()[0], source);
});
