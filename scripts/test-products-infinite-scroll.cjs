/** Browser regression; catalog fixtures only intercept GET requests and never write data. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");

const base = process.env.PRODUCT_SCROLL_TEST_URL || "http://localhost:3000";
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const cardsSelector = "main [data-product-card]";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function eventually(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  let cause;
  do {
    try { await check(); return; } catch (error) { cause = error; }
    await pause(80);
  } while (Date.now() < end);
  throw new Error(label, { cause });
}

function gate() {
  let release;
  return { promise: new Promise((resolve) => { release = resolve; }), release: () => release() };
}

function products(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    _id: `${prefix}-${index + 1}`, name: `${prefix} product ${index + 1}`,
    price: 500 + index * 10, images: [], category: "Everyday", stock: 10,
    reviewCount: 0, ratingAvg: 0,
  }));
}

function payload(items, page, limit) {
  return { products: items.slice((page - 1) * limit, page * limit), total: items.length,
    page, totalPages: Math.ceil(items.length / limit), priceRange: { min: 0, max: 2000 } };
}

async function scrollBottom(page) {
  // The mobile footer can exceed one viewport; reach the product list's end.
  await page.getByText(/explored \d+ of [\d,]+ products/).scrollIntoViewIfNeeded();
}

async function session(browser, viewport, handler) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
  await context.route((url) => url.pathname === "/api/categories", (route) => route.fulfill({ json: [{ name: "Everyday" }, { name: "Filtered" }] }));
  const requests = [];
  await context.route((url) => url.pathname === "/api/products", async (route) => {
    const url = new URL(route.request().url());
    const request = { page: Number(url.searchParams.get("page") || 1),
      limit: Number(url.searchParams.get("limit") || 18), category: url.searchParams.get("category") || "" };
    requests.push(request);
    await handler(route, request);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/products`, { waitUntil: "domcontentloaded", timeout: 90000 });
  // The shared cart provider remounts its subtree when the guest session resolves.
  await eventually(async () => assert.ok(await page.evaluate(() => localStorage.getItem("irb-cart") !== null)), "Guest session finishes initializing", 60000);
  await eventually(async () => assert.equal(await page.locator(cardsSelector).count(), 18), "First page loads", 60000);
  assert.equal(await page.getByRole("button", { name: /^load more$/i }).count(), 0, "Manual Load More action is removed");
  return { context, page, requests, errors };
}

async function normalScroll(browser, viewport, screenshots) {
  const items = products("Scroll", 41);
  const pending = gate();
  const state = await session(browser, viewport, async (route, request) => {
    if (request.page === 2) await pending.promise;
    await route.fulfill({ json: payload(items, request.page, request.limit) });
  });
  const { context, page, requests, errors } = state;
  try {
    assert.equal(requests.filter((request) => request.page > 1).length, 0, "Next page waits until the user approaches the list end");
    await scrollBottom(page);
    await eventually(async () => assert.equal(requests.filter((request) => request.page === 2).length, 1), "Scrolling requests page two");
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await scrollBottom(page);
      await pause(80);
    }
    assert.equal(requests.filter((request) => request.page === 2).length, 1, "Pending page is requested only once despite repeated scrolling");
    assert.equal(await page.locator(cardsSelector).count(), 18, "Existing products stay visible while more load");
    pending.release();
    await eventually(async () => assert.equal(await page.locator(cardsSelector).count(), 36), "Page two appends products");
    await scrollBottom(page);
    await eventually(async () => assert.equal(await page.locator(cardsSelector).count(), 41), "Final partial page appends automatically");
    await scrollBottom(page);
    await pause(350);
    assert.deepEqual(requests.filter((request) => request.page > 1).map((request) => request.page), [2, 3], `Each later page requested once and pagination stops at completion: ${JSON.stringify(requests)}`);
    assert.deepEqual(await page.locator(cardsSelector).evaluateAll((cards) => cards.map((card) => card.dataset.productCard)), items.map((item) => item._id), "All products retain order without duplicates");
    assert.ok(await page.getByText(/explored 41 of 41 products/).isVisible(), "Completion count is visible");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow");
    assert.deepEqual(errors, [], "No browser runtime errors");
    const screenshot = path.join(screenshots, `products-scroll-${viewport.width}.png`);
    await page.screenshot({ path: screenshot });
    console.log(`PASS ${viewport.width}px: automatic pagination, pending request guard, product order, completion. SCREENSHOT ${screenshot}`);
  } finally { pending.release(); await context.close(); }
}

async function failureRetry(browser, viewport) {
  const items = products("Retry", 23);
  let secondPageAttempts = 0;
  const { context, page, requests, errors } = await session(browser, viewport, async (route, request) => {
    if (request.page === 2 && ++secondPageAttempts === 1) {
      await route.fulfill({ status: 503, json: { error: "Temporary test failure" } });
    } else await route.fulfill({ json: payload(items, request.page, request.limit) });
  });
  try {
    await scrollBottom(page);
    await page.getByRole("alert").filter({ hasText: "Couldn't load more products" }).waitFor();
    assert.equal(await page.locator(cardsSelector).count(), 18, "A later-page failure preserves loaded products");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await scrollBottom(page);
    await pause(400);
    assert.equal(secondPageAttempts, 1, "Failure does not create an automatic retry loop");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await eventually(async () => assert.equal(await page.locator(cardsSelector).count(), 23), "Error retry appends the missing page");
    assert.deepEqual(requests.filter((request) => request.page > 1).map((request) => request.page), [2, 2], "Retry requests the failed page again");
    assert.equal(await page.getByRole("alert").filter({ hasText: "Couldn't load more products" }).count(), 0, "Recovered error clears");
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log(`PASS ${viewport.width}px: failed page preserves cards, pauses retries, recovers on retry.`);
  } finally { await context.close(); }
}

async function filterWhilePending(browser, viewport) {
  const items = products("Original", 41);
  const filtered = products("Filtered", 2);
  const pending = gate();
  const { context, page, requests, errors } = await session(browser, viewport, async (route, request) => {
    if (!request.category && request.page === 2) await pending.promise;
    await route.fulfill({ json: payload(request.category ? filtered : items, request.page, request.limit) });
  });
  try {
    await scrollBottom(page);
    await eventually(async () => assert.equal(requests.filter((request) => request.page === 2).length, 1), "Old catalog's next page is pending");
    const mobile = viewport.width < 1280;
    if (mobile) await page.getByRole("button", { name: /Filter & sort/ }).click();
    await page.locator(`#category-${mobile ? "mobile" : "desktop"}`).click();
    await page.getByRole("option", { name: "Filtered", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("category") === "Filtered");
    await eventually(async () => assert.equal(await page.locator(cardsSelector).count(), 2), "Filter replaces catalog from page one");
    if (mobile) await page.getByRole("button", { name: "Close filters", exact: true }).click();
    pending.release();
    await pause(350);
    assert.deepEqual(await page.locator(cardsSelector).evaluateAll((cards) => cards.map((card) => card.dataset.productCard)), filtered.map((item) => item._id), "Delayed old response never leaks into filtered products");
    assert.deepEqual(requests.filter((request) => request.category).map((request) => request.page), [1], "Filtered catalog resets to the first page");
    await scrollBottom(page);
    await pause(250);
    assert.equal(requests.filter((request) => request.category).length, 1, "Completed filtered catalog does not request another page");
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log(`PASS ${viewport.width}px: filter cancels pending pagination and replaces catalog cleanly.`);
  } finally { pending.release(); await context.close(); }
}

async function main() {
  const screenshots = await fs.mkdtemp(path.join(os.tmpdir(), "joro-products-scroll-"));
  const browser = await chromium.launch({
    executablePath: process.env.PRODUCT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    for (const viewport of viewports) {
      await normalScroll(browser, viewport, screenshots);
      await failureRetry(browser, viewport);
      await filterWhilePending(browser, viewport);
    }
    console.log(JSON.stringify({ status: "passed", screenshots, viewports }, null, 2));
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
