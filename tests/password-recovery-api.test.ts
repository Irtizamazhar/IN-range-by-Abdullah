import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/customer/password-recovery/route";

function request(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/customer/password-recovery", {
    method: "POST", headers: { "Content-Type": "application/json", origin, "x-forwarded-for": "192.0.2.99" }, body: JSON.stringify(body),
  });
}

test("recovery API rejects a cross-origin request before touching storage or SMTP", async () => {
  assert.equal((await POST(request({ action: "request", email: "test@example.test" }, "https://attacker.invalid"))).status, 403);
});

test("recovery API validates email, numeric code and password policy server-side", async () => {
  for (const body of [
    { action: "request", email: "invalid" },
    { action: "verify", challengeId: "11111111-1111-4111-8111-111111111111", code: "abcdef" },
    { action: "reset", authorization: "a".repeat(64), password: "12345", confirm: "12345" },
    { action: "reset", authorization: "a".repeat(64), password: "é".repeat(37), confirm: "é".repeat(37) },
  ]) assert.equal((await POST(request(body))).status, 400);
});

test("recovery API rejects confirmation mismatch before hashing or storage", async () => {
  const response = await POST(request({ action: "reset", authorization: "a".repeat(64), password: "123456", confirm: "mismatch" }));
  assert.equal(response.status, 400); assert.match((await response.json()).error, /Passwords do not match/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unconfigured mail returns an explicit blocker without sending or looking up an account", async () => {
  const keys = ["EMAIL_HOST", "SMTP_HOST"] as const;
  const previous = keys.map(key => process.env[key]);
  try {
    keys.forEach(key => { delete process.env[key]; });
    const response = await POST(request({ action: "request", email: "never-sent@example.test" }));
    assert.equal(response.status, 503); assert.match((await response.json()).error, /unavailable/);
  } finally { keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }); }
});
