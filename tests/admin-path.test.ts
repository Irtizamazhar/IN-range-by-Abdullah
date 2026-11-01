import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { adminBasePath, isInternalAdminPath, toInternalAdminPath } from "../lib/admin-path";
import { loadingMessageForRoute, loadingNeedsOpaqueBackground, setAdminRoutePrefix } from "../lib/loading-route-message";
import { middleware } from "../middleware";

// Fixture value only; the real admin path lives in the server environment, never in the repo.
const BASE = "/team-console-1234";

test("ADMIN_SECRET_PATH is validated and fails closed", () => {
  assert.equal(adminBasePath(BASE), BASE);
  assert.equal(adminBasePath(` ${BASE}/ `), BASE);
  for (const bad of [undefined, "", "/", "admin", "/admin", "/api", "/products", "/vendor", "/login", "/short",
    "team-console-1234", "/team console", "/team/console-1234", "/../console-1234", "/-team-console", "/team_console_1234"]) {
    assert.equal(adminBasePath(bad), null, String(bad));
  }
});

test("secret paths map onto the internal /admin pages", () => {
  assert.equal(toInternalAdminPath(BASE, BASE), "/admin");
  assert.equal(toInternalAdminPath(`${BASE}/orders/abc`, BASE), "/admin/orders/abc");
  assert.equal(toInternalAdminPath(`${BASE}x/orders`, BASE), null);
  assert.equal(toInternalAdminPath("/products", BASE), null);
  assert.equal(toInternalAdminPath(`${BASE}/orders`, null), null);
  assert.equal(isInternalAdminPath("/admin"), true);
  assert.equal(isInternalAdminPath("/admin/login"), true);
  assert.equal(isInternalAdminPath("/administrator"), false);
  assert.equal(isInternalAdminPath("/api/admin/notifications"), false);
});

async function run(pathname: string, cookie?: string) {
  const headers = cookie ? { cookie } : undefined;
  return middleware(new NextRequest(new URL(pathname, "http://localhost:3000"), { headers }));
}

test("middleware: /admin is a 404, the secret path is served with the existing auth gate", async () => {
  const previous = process.env.ADMIN_SECRET_PATH;
  process.env.ADMIN_SECRET_PATH = BASE;
  try {
    for (const old of ["/admin", "/admin/login", "/admin/dashboard", "/admin/orders/abc"]) {
      const res = await run(old);
      assert.equal(res.status, 404, old);
      assert.equal(res.headers.get("x-middleware-rewrite"), "http://localhost:3000/_admin-not-found", old);
      assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/, old);
    }

    const login = await run(`${BASE}/login`);
    assert.equal(login.headers.get("x-middleware-rewrite"), "http://localhost:3000/admin/login");
    assert.match(login.headers.get("cache-control") ?? "", /no-store/);

    for (const page of [BASE, `${BASE}/dashboard`, `${BASE}/orders/abc?tab=x`]) {
      const res = await run(page);
      assert.equal(res.status, 307, page);
      assert.equal(res.headers.get("location"), `http://localhost:3000${BASE}/login`, page);
    }
    const forged = await run(`${BASE}/dashboard`, "next-auth.session-token.admin=forged");
    assert.equal(forged.headers.get("location"), `http://localhost:3000${BASE}/login`);

    // Other areas keep their behaviour.
    assert.equal((await run("/products")).headers.get("x-middleware-next"), "1");
    assert.equal((await run("/vendor/dashboard")).headers.get("location"), "http://localhost:3000/vendor/login");

    delete process.env.ADMIN_SECRET_PATH;
    assert.equal((await run("/admin/login")).status, 404);
    // Without a configured path nothing is rewritten onto the admin pages.
    assert.equal((await run(`${BASE}/login`)).headers.get("x-middleware-rewrite"), null);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SECRET_PATH;
    else process.env.ADMIN_SECRET_PATH = previous;
  }
});

test("route loader classifies admin URLs only once the admin panel registers its prefix", () => {
  setAdminRoutePrefix("");
  assert.equal(loadingMessageForRoute(`${BASE}/orders`), "Loading JORO...");
  setAdminRoutePrefix(BASE);
  try {
    assert.equal(loadingMessageForRoute(`${BASE}/dashboard`), "Loading dashboard...");
    assert.equal(loadingMessageForRoute(`${BASE}/vendors`), "Loading management tools...");
    assert.equal(loadingMessageForRoute(`${BASE}/login`), "Preparing your account...");
    assert.equal(loadingNeedsOpaqueBackground(`${BASE}/orders`), true);
    assert.equal(loadingNeedsOpaqueBackground(`${BASE}/login`), false);
  } finally {
    setAdminRoutePrefix("");
  }
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test("no admin page links hard-code the retired /admin URL", () => {
  // app/admin/loading.tsx passes an internal route hint, not a URL.
  const allowed = new Set([path.join("app", "admin", "loading.tsx")]);
  const offenders = ["app", "components", "lib", "hooks"]
    .flatMap(sourceFiles)
    .filter((file) => !allowed.has(file) && !file.startsWith(path.join("lib", "admin-path")) && !file.startsWith(path.join("lib", "loading-route-message")))
    .flatMap((file) => readFileSync(file, "utf8").split("\n").flatMap((line, index) =>
      /["'`]\/admin(\/|["'`?#])/.test(line) ? [`${file}:${index + 1}`] : []));
  assert.deepEqual(offenders, []);
});
