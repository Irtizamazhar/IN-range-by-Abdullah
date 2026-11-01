import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL || "http://localhost:3100";
// The admin panel is only served under ADMIN_SECRET_PATH (never committed); /admin is a 404.
const adminPath = process.env.ADMIN_SECRET_PATH;
if (!adminPath) throw new Error("Set ADMIN_SECRET_PATH to the deployed admin path to run the smoke test.");
const checks = [
  ["/", 200],
  ["/products", 200],
  ["/vendor/login", 200],
  [`${adminPath}/login`, 200],
  ["/admin", 404],
  ["/admin/login", 404],
  ["/api/admin/notifications", 401],
  ["/api/admin/sidebar-badges", 401],
  ["/api/vendor/appeal", 401, "POST"],
  ["/api/vendor/appeal/upload", 401, "POST"],
  ["/api/orders", 401, "POST"],
];

for (const [path, expected, method = "GET"] of checks) {
  const response = await fetch(new URL(path, base), {
    method, redirect: "manual", signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, expected, `${method} ${path}`);
  console.log(`PASS ${method} ${path}: ${response.status}`);
}

for (const path of ["/api/vendor/appeal", "/api/vendor/appeal/upload"]) {
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: { Cookie: "vendor_appeal_token=invalid-token" },
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 401, `Forged appeal cookie: ${path}`);
  console.log(`PASS forged cookie rejected: ${path}`);
}
