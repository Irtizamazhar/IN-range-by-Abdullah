import assert from "node:assert/strict";
import { test } from "node:test";
import { customerRegistrationSameOrigin } from "../lib/customer-registration-origin";

const names = ["NODE_ENV", "NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL", "CANONICAL_HOST", "JORO_PREVIEW_ORIGIN"] as const;
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));

function request(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

test("registration accepts configured public origins through an exact proxy host match", () => {
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_APP_URL = "https://joro.pk";
  process.env.JORO_PREVIEW_ORIGIN = "https://preview.joro.pk";
  delete process.env.NEXTAUTH_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.CANONICAL_HOST;
  try {
    assert.doesNotThrow(() => customerRegistrationSameOrigin(request("https://joro.pk/api/customer/register", { origin: "https://joro.pk", host: "joro.pk" })));
    assert.doesNotThrow(() => customerRegistrationSameOrigin(request("http://127.0.0.1:3000/api/customer/register", { origin: "https://preview.joro.pk", host: "127.0.0.1:3000", "x-forwarded-host": "preview.joro.pk", "x-forwarded-proto": "https" })));
    assert.throws(() => customerRegistrationSameOrigin(request("https://joro.pk/api/customer/register", { origin: "https://evil.example", host: "joro.pk" })), /official JORO website/);
    assert.throws(() => customerRegistrationSameOrigin(request("http://127.0.0.1:3000/api/customer/register", { origin: "https://preview.joro.pk", host: "127.0.0.1:3000", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" })), /official JORO website/);
    assert.throws(() => customerRegistrationSameOrigin(request("https://joro.pk/api/customer/register", { origin: "https://preview.joro.pk", host: "joro.pk" })), /official JORO website/);
    assert.throws(() => customerRegistrationSameOrigin(request("http://127.0.0.1:3000/api/customer/register", { origin: "https://preview.joro.pk", host: "127.0.0.1:3000", "x-forwarded-host": "preview.joro.pk", "x-forwarded-proto": "http" })), /official JORO website/);
    assert.throws(() => customerRegistrationSameOrigin(request("https://other.example/api/customer/register", { origin: "https://other.example", host: "other.example" })), /official JORO website/);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
