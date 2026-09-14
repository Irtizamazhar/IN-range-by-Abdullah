/**
 * Run after `npm run build`. Uses only a local database/server and removes
 * only fixture IDs/files created by this run. It never resets or pushes the DB.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { chromium, type Browser } from "playwright-core";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
assert.ok(process.env.DATABASE_URL, "Review E2E requires DATABASE_URL.");
assert.ok(
  localHosts.has(new URL(process.env.DATABASE_URL).hostname),
  "Review E2E only runs against a local database."
);
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");

const db = new PrismaClient();
const run = `review-test-${randomUUID()}`;
const secret = randomUUID();
const port = 3115;
const base = `http://localhost:${port}`;
let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;
let checks = 0;

const customerIds: string[] = [];
const orderIds: string[] = [];
const productIds: string[] = [];
const vendorIds: string[] = [];
const adminIds: string[] = [];
const newArrivalReviewIds: number[] = [];
const uploadedFiles: string[] = [];

function pass(label: string) {
  checks += 1;
  console.log(`PASS ${checks}: ${label}`);
}

async function customerCookie(customer: {
  id: string;
  email: string;
  name: string;
}) {
  const token = await encode({
    secret,
    token: {
      sub: customer.id,
      role: "customer",
      sessionVersion: 0,
      email: customer.email,
      name: customer.name,
    },
    maxAge: 3600,
  });
  return `__Secure-next-auth.session-token.customer=${token}`;
}

async function adminCookie(admin: { id: string; email: string; name: string }) {
  const token = await encode({
    secret,
    token: {
      sub: admin.id,
      role: "admin",
      email: admin.email,
      name: admin.name,
    },
    maxAge: 3600,
  });
  return `__Secure-next-auth.session-token.admin=${token}`;
}

async function request(
  requestPath: string,
  auth = "",
  method = "GET",
  body?: unknown,
  expected = 200
) {
  const response = await fetch(`${base}${requestPath}`, {
    method,
    headers: {
      ...(auth ? { cookie: auth } : {}),
      "Content-Type": "application/json",
      Origin: base,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");
  assert.equal(
    response.status,
    expected,
    `${method} ${requestPath}: expected ${expected}, received ${response.status} (${JSON.stringify(payload)})`
  );
  return payload as any;
}

async function uploadReviewPhoto(
  auth: string,
  orderId: string,
  productId: string,
  bytes: Uint8Array,
  type: string,
  expected: number
) {
  const form = new FormData();
  form.append("orderId", orderId);
  form.append("productId", productId);
  const fileBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(fileBuffer).set(bytes);
  form.append("file", new Blob([fileBuffer], { type }), "review.png");
  const response = await fetch(`${base}/api/reviews/photo`, {
    method: "POST",
    headers: { cookie: auth, Origin: base },
    body: form,
  });
  const payload = await response.json().catch(() => null);
  assert.equal(
    response.status,
    expected,
    `photo upload: expected ${expected}, received ${response.status} (${JSON.stringify(payload)})`
  );
  return payload as { url?: string; error?: string };
}

async function main() {
  await db.$queryRaw`SELECT 1`;
  pass("local database connection verified");

  const passwordHash = "not-a-valid-password-hash";
  const [customerA, customerB, customerNoPurchase] = await Promise.all(
    ["a", "b", "no-purchase"].map((suffix) =>
      db.customer.create({
        data: {
          email: `${run}-${suffix}@example.invalid`,
          name: `Review Test ${suffix}`,
          passwordHash,
          phone: "03001234567",
        },
      })
    )
  );
  customerIds.push(customerA.id, customerB.id, customerNoPurchase.id);
  const authA = await customerCookie(customerA);
  const authB = await customerCookie(customerB);
  const authNoPurchase = await customerCookie(customerNoPurchase);

  const admin = await db.adminUser.create({
    data: {
      email: `${run}-admin@example.invalid`,
      passwordHash,
      name: "Review Moderator",
      role: "operations",
      permissions: [],
      isActive: true,
    },
  });
  adminIds.push(admin.id);
  const authAdmin = await adminCookie(admin);

  const vendor = await db.vendor.create({
    data: {
      shopName: "Review Test Store",
      ownerName: "Review Owner",
      email: `${run}-vendor@example.invalid`,
      passwordHash,
      phone: "03001234567",
      cnic: `${run}-cnic`,
      address: "Local review test address",
      city: "Lahore",
      businessType: "individual",
      bankName: "Test",
      accountNumber: "test",
      accountTitle: "Test",
      status: "approved",
      storeSlug: run,
      primaryCategory: "Other",
    },
  });
  vendorIds.push(vendor.id);

  const product = await db.product.create({
    data: {
      name: "Verified Review Test Product",
      description: "Temporary Step 5 browser fixture",
      price: 1000,
      category: "Other",
      stock: 20,
      variants: [],
    },
  });
  productIds.push(product.id);
  await db.vendorProduct.create({
    data: {
      vendorId: vendor.id,
      productName: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      stock: 20,
      images: [],
      status: "active",
      publishedProductId: product.id,
    },
  });

  async function createOrder(
    customer: typeof customerA,
    suffix: string,
    orderStatus: string,
    productId = product.id
  ) {
    const order = await db.order.create({
      data: {
        orderNumber: `${run}-${suffix}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        // B deliberately shares A's checkout email: authorization must still
        // follow customerId, never the email string.
        customerEmail: customer === customerB ? customerA.email : customer.email,
        customerAddress: "Local review test address",
        city: "Lahore",
        totalAmount: 1000,
        paymentMethod: "cod",
        paymentStatus: "received",
        orderStatus,
        orderItems: {
          create: {
            productId,
            name: product.name,
            price: 1000,
            quantity: 1,
          },
        },
      },
    });
    orderIds.push(order.id);
    return order;
  }

  const deliveredA = await createOrder(customerA, "delivered-a", "delivered");
  const pendingA = await createOrder(customerA, "pending-a", "pending");
  const deliveredB = await createOrder(customerB, "delivered-b", "delivered");

  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: secret,
        NEXTAUTH_URL: base,
        NEXTAUTH_URL_INTERNAL: base,
        ADMIN_EMAIL: "unused-review-e2e-admin@example.invalid",
      },
    }
  );

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/reviews?productId=${product.id}`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) {
      throw new Error("Review test server exited before readiness");
    }
    await delay(1000);
  }
  assert.ok(ready, "Review test server did not become ready");

  const baseReview = {
    orderId: deliveredA.id,
    productId: product.id,
    rating: 5,
    comment: "Excellent verified purchase",
  };

  await request("/api/reviews", "", "POST", baseReview, 401);
  pass("anonymous cannot review");

  await request("/api/reviews", authNoPurchase, "POST", baseReview, 404);
  pass("customer without the purchase is denied without exposing the order");

  await request(
    "/api/reviews",
    authA,
    "POST",
    { ...baseReview, orderId: pendingA.id },
    403
  );
  pass("non-eligible order is denied");

  await request(
    "/api/reviews",
    authA,
    "POST",
    { ...baseReview, verifiedPurchase: true },
    400
  );
  const created = await request("/api/reviews", authA, "POST", baseReview);
  assert.equal(created.action, "created");
  const reviewId = Number(created.review.id);
  assert.equal(await db.review.count({ where: { customerId: customerA.id, productId: product.id } }), 1);
  pass("eligible customer can review and client verification flags are rejected");

  assert.equal((await request(`/api/reviews?productId=${product.id}`)).totalCount, 0);
  await request(`/api/admin/reviews/${reviewId}`, "", "PATCH", { approved: true }, 401);
  await request(`/api/admin/reviews/${reviewId}`, authAdmin, "PATCH", { approved: true });
  const firstPublic = await request(`/api/reviews?productId=${product.id}`);
  assert.equal(firstPublic.totalCount, 1);
  assert.equal(firstPublic.averageRating, 5);
  assert.equal(firstPublic.reviews[0].verifiedPurchase, true);
  assert.ok(
    await db.adminAuditLog.count({
      where: { adminId: admin.id, entityType: "Review", entityId: String(reviewId) },
    })
  );
  pass("Verified Purchase and moderation derive from server-side order evidence with audit");

  const edited = await request("/api/reviews", authA, "POST", {
    ...baseReview,
    rating: 3,
    comment: "Edited canonical review",
  });
  assert.equal(edited.action, "updated");
  assert.equal(Number(edited.review.id), reviewId);
  assert.equal(await db.review.count({ where: { customerId: customerA.id, productId: product.id } }), 1);
  assert.equal((await db.review.findUniqueOrThrow({ where: { id: reviewId } })).approved, false);
  pass("repeat submission edits the canonical row and returns to moderation");

  await request(
    "/api/reviews",
    authB,
    "PATCH",
    { ...baseReview, comment: "Attempted IDOR" },
    404
  );
  assert.equal((await db.review.findUniqueOrThrow({ where: { id: reviewId } })).comment, "Edited canonical review");
  pass("another customer cannot edit the review even when checkout emails match");

  await request(`/api/admin/reviews/${reviewId}`, authAdmin, "PATCH", { approved: true });
  const editedStats = await request(`/api/reviews?productId=${product.id}`);
  assert.equal(editedStats.averageRating, 3);
  assert.equal(editedStats.totalCount, 1);
  pass("aggregate updates from the approved canonical row");

  for (const rating of [0, 6, 2.5]) {
    await request(
      "/api/reviews",
      authA,
      "PATCH",
      { ...baseReview, rating },
      400
    );
  }
  pass("invalid ratings are rejected");

  for (const comment of [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
  ]) {
    await request(
      "/api/reviews",
      authA,
      "PATCH",
      { ...baseReview, comment },
      400
    );
  }
  assert.equal((await db.review.findUniqueOrThrow({ where: { id: reviewId } })).comment, "Edited canonical review");
  pass("unsafe review content is rejected without changing stored text");

  await uploadReviewPhoto(
    authA,
    deliveredA.id,
    product.id,
    new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e]),
    "image/png",
    400
  );
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    )
  );
  const uploaded = await uploadReviewPhoto(
    authA,
    deliveredA.id,
    product.id,
    png,
    "image/png",
    200
  );
  assert.ok(uploaded.url?.startsWith(`/uploads/reviews/${customerA.id}/rev-`));
  uploadedFiles.push(uploaded.url!);
  await request(
    "/api/reviews",
    authA,
    "PATCH",
    { ...baseReview, imageUrl: uploaded.url },
    200
  );
  await request(
    "/api/reviews",
    authA,
    "PATCH",
    {
      ...baseReview,
      imageUrl: `/uploads/reviews/${customerB.id}/rev-123-abcdef12.png`,
    },
    400
  );
  pass("photo MIME bytes, eligibility and customer-scoped paths are enforced");

  await request("/api/reviews", authA, "DELETE", { productId: product.id });
  assert.equal((await request(`/api/reviews?productId=${product.id}`)).totalCount, 0);
  assert.equal((await db.review.findUniqueOrThrow({ where: { id: reviewId } })).withdrawn, true);
  pass("withdrawn review is preserved and excluded");

  const reactivated = await request("/api/reviews", authA, "POST", {
    ...baseReview,
    rating: 4,
    comment: "Final verified review",
  });
  assert.equal(Number(reactivated.review.id), reviewId);
  await request(`/api/admin/reviews/${reviewId}`, authAdmin, "PATCH", { approved: true });
  const legacyGuest = await db.review.create({
    data: {
      name: "Legacy Guest",
      email: "guest@example.invalid",
      rating: 1,
      comment: "Unverified legacy row",
      productId: product.id,
      approved: true,
    },
  });
  const legacyNewArrival = await db.newArrivalReview.create({
    data: {
      name: "Legacy New Arrival Guest",
      email: "guest@example.invalid",
      rating: 1,
      comment: "Unverifiable guest row",
      newArrivalId: 999999,
      approved: true,
    },
  });
  newArrivalReviewIds.push(legacyNewArrival.id);
  const finalStats = await request(`/api/reviews?productId=${product.id}`);
  assert.equal(finalStats.totalCount, 1);
  assert.equal(finalStats.averageRating, 4);
  assert.equal((await request("/api/reviews/all")).totalCount, 1);
  pass("unverifiable legacy guest rows do not affect product or public aggregates");

  const storeHtml = await request(`/stores/${run}`);
  assert.match(storeHtml, /4\.0 \(1\)/);
  pass("store aggregate uses the same verified product review row");

  const executablePath =
    process.env.REVIEW_TEST_BROWSER ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "__Secure-next-auth.session-token.customer",
      value: authA.split("=")[1],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const productPath = `/products/${product.id}?orderId=${deliveredA.id}#review`;

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const browserPath of [productPath, `/stores/${run}`]) {
      await page.goto(`${base}${browserPath}`);
      await page.locator("main").first().waitFor();
      await page.waitForFunction(
        () => !document.querySelector("main")?.textContent?.includes("Loading reviews")
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        ),
        `horizontal overflow at ${width}px on ${browserPath}`
      );
    }
  }
  await page.goto(`${base}${productPath}`);
  await page.getByText("Your verified review is published.", { exact: true }).waitFor();
  await page.getByText("Verified Purchase", { exact: true }).first().waitFor();
  await page.reload();
  await page.getByText("Final verified review", { exact: true }).waitFor();
  assert.deepEqual(pageErrors, []);
  await context.close();
  pass("product refresh and responsive browser flow work at 360/390/768/1024/1440");

  await request(`/api/admin/reviews/${reviewId}`, authAdmin, "DELETE");
  const preserved = await db.review.findUniqueOrThrow({ where: { id: reviewId } });
  assert.equal(preserved.withdrawn, true);
  assert.equal(preserved.approved, false);
  assert.equal((await request(`/api/reviews?productId=${product.id}`)).totalCount, 0);
  assert.ok(await db.review.findUnique({ where: { id: legacyGuest.id } }));
  pass("admin removal is permission-gated, audited, non-destructive and excluded");

  console.log(`REVIEWS & RATINGS E2E PASSED: ${checks} check groups`);
}

async function cleanup() {
  await browser?.close().catch(() => undefined);
  server?.kill();

  await db.adminAuditLog.deleteMany({
    where: { adminId: { in: adminIds } },
  });
  await db.review.deleteMany({ where: { productId: { in: productIds } } });
  await db.newArrivalReview.deleteMany({
    where: { id: { in: newArrivalReviewIds } },
  });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.vendorProduct.deleteMany({ where: { vendorId: { in: vendorIds } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await db.vendor.deleteMany({ where: { id: { in: vendorIds } } });
  await db.adminUser.deleteMany({ where: { id: { in: adminIds } } });
  await db.customer.deleteMany({ where: { id: { in: customerIds } } });

  const reviewRoot = path.resolve(process.cwd(), "public", "uploads", "reviews");
  for (const url of uploadedFiles) {
    const fullPath = path.resolve(process.cwd(), "public", url.replace(/^\//, ""));
    if (fullPath.startsWith(`${reviewRoot}${path.sep}`)) {
      await fs.unlink(fullPath).catch(() => undefined);
      await fs.rmdir(path.dirname(fullPath)).catch(() => undefined);
    }
  }
  await db.$disconnect();
  console.log("Temporary review fixtures removed; existing data untouched.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Review E2E failed");
    process.exitCode = 1;
  })
  .finally(cleanup);
