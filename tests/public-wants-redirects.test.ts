import test from "node:test";
import assert from "node:assert/strict";
import { GET as connect } from "../app/(user)/joro-connect/route";
import { GET as trending } from "../app/(user)/wants/trending/route";

const keys = ["NODE_ENV", "NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "CANONICAL_HOST", "NEXT_PUBLIC_SITE_URL"];
function environment(values: Record<string, string>, run: () => void) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
function destination(handler: typeof connect, input: string) {
  const response = handler(new Request(input, { headers: { host: "attacker.example", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "http" } }));
  assert.equal(response.status, 308);
  const url = new URL(response.headers.get("location")!);
  assert.equal(url.pathname, "/wants");
  assert.equal(url.hash, "");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  return url;
}

test("production aliases use the canonical public origin despite internal URLs and hostile host headers", () => {
  environment({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://other.example" }, () => {
    for (const [handler, path, tab] of [[connect, "/joro-connect", "all"], [trending, "/wants/trending", "trending"]] as const) {
      const url = destination(handler, `https://0.0.0.0:3000${path}`);
      assert.equal(url.origin, "https://joro.pk");
      assert.equal(url.searchParams.get("tab"), tab);
    }
  });
});

test("Connect retains filters, repeated tracking parameters and legacy search mapping, forcing its original tab", () => {
  environment({ NODE_ENV: "production" }, () => {
    const url = destination(connect, "https://www.joro.pk/joro-connect?tab=mine&type=service&city=%20Taxila%20&search=wood%20%26%20doors&q=old&category=Carpentry&utm_source=a&utm_source=b");
    assert.equal(url.origin, "https://joro.pk");
    assert.equal(url.searchParams.get("tab"), "all");
    assert.equal(url.searchParams.get("type"), "SERVICE");
    assert.equal(url.searchParams.get("city"), "Taxila");
    assert.equal(url.searchParams.get("q"), "wood & doors");
    assert.equal(url.searchParams.has("search"), false);
    assert.equal(url.searchParams.get("category"), "Carpentry");
    assert.deepEqual(url.searchParams.getAll("utm_source"), ["a", "b"]);
    assert.equal(destination(connect, "https://joro.pk/joro-connect?q=existing").searchParams.get("q"), "existing");
  });
});

test("Connect retains existing type validation and city/search length limits", () => {
  environment({ NODE_ENV: "production" }, () => {
    const url = destination(connect, `https://joro.pk/joro-connect?type=invalid&city=${"x".repeat(110)}&search=${"y".repeat(110)}`);
    assert.equal(url.searchParams.has("type"), false);
    assert.equal(url.searchParams.get("city")!.length, 100);
    assert.equal(url.searchParams.get("q")!.length, 100);
    const blank = destination(connect, "https://joro.pk/joro-connect?city=%20&search=%20&q=old");
    assert.equal(blank.searchParams.has("city"), false);
    assert.equal(blank.searchParams.has("q"), false);
  });
});

test("Trending preserves filter/query values and forces exactly one trending tab", () => {
  environment({ NODE_ENV: "production" }, () => {
    const url = destination(trending, "https://0.0.0.0:3000/wants/trending?tab=mine&tab=joined&city=Lahore&type=PRODUCT&q=phone&category=Accessories&utm_campaign=summer");
    assert.equal(url.origin, "https://joro.pk");
    assert.deepEqual(url.searchParams.getAll("tab"), ["trending"]);
    for (const [key, value] of Object.entries({ city: "Lahore", type: "PRODUCT", q: "phone", category: "Accessories", utm_campaign: "summer" })) assert.equal(url.searchParams.get(key), value);
  });
});

test("query values cannot change the destination origin/path or send either alias back to itself", () => {
  environment({ NODE_ENV: "production" }, () => {
    for (const handler of [connect, trending]) {
      const url = destination(handler, "https://evil.example/alias?next=https%3A%2F%2Fevil.example&redirect=%2F%2Fevil.example&city=%2F%2Fevil.example&search=%2Fwants%2Ftrending%23fragment");
      assert.equal(url.origin, "https://joro.pk");
      assert.equal(url.pathname, "/wants");
      assert.equal(url.hash, "");
    }
  });
});

test("development uses the validated configured origin or localhost fallback, ignoring request hosts", () => {
  for (const [values, expected] of [
    [{ NODE_ENV: "development" }, "http://localhost:3000"],
    [{ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3100" }, "http://localhost:3100"],
    [{ NODE_ENV: "development", NEXTAUTH_URL: "http://127.0.0.1:3200" }, "http://127.0.0.1:3200"],
  ] as const) environment(values, () => {
    for (const handler of [connect, trending]) assert.equal(destination(handler, "http://untrusted.example/alias").origin, expected);
  });
});

test("invalid development origins fail closed instead of creating redirects", () => {
  for (const origin of ["https://user:password@example.test", "https://example.test/path", "https://example.test/?next=evil", "javascript:alert(1)"]) {
    environment({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: origin }, () => {
      for (const handler of [connect, trending]) assert.throws(() => handler(new Request("http://localhost:3000/alias")));
    });
  }
});
