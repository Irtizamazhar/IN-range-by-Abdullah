/** Browser layout/behavior regression. Fixtures exist only in intercepted GET responses. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");

const base = process.env.PRODUCT_DESIGN_TEST_URL || "http://localhost:3000";
const requestedWidths = process.argv.slice(2).find((argument) => !argument.startsWith("--"))?.split(",").map(Number);
const layoutOnly = process.argv.includes("--layout-only");
const viewports = [
  { width: 1440, height: 1000, columns: 4 },
  { width: 1024, height: 900, columns: 3 },
  { width: 768, height: 1024, columns: 3 },
  { width: 390, height: 844, columns: 2 },
  { width: 360, height: 800, columns: 2 },
  { width: 320, height: 720, columns: 1 },
];

async function eventually(check, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let cause;
  do {
    try { await check(); return; } catch (error) { cause = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(description, { cause });
}

function fixturesFrom(products) {
  const overrides = [
    { price: 799, originalPrice: 999, discountPercent: 20, stock: 2, reviewCount: 7, ratingAvg: 4.6 },
    { price: 1250, originalPrice: undefined, discountPercent: 0, stock: 9, reviewCount: 0, ratingAvg: 0 },
    { price: 4234233, originalPrice: undefined, discountPercent: 0, stock: 0, reviewCount: 5, ratingAvg: 3.9 },
    { name: `${products[0].name} - complete household organizer with adjustable compartments and accessories for everyday storage and travel`, price: 12345, originalPrice: 16000, discountPercent: 23, stock: 6, reviewCount: 0 },
    { price: 9876543210, originalPrice: 9999999999.99, discountPercent: 1, stock: 4, reviewCount: 125, ratingAvg: 4.8 },
    { price: 343, originalPrice: 400, discountPercent: 14, stock: 4, variants: ["Standard", "Large"], reviewCount: 0 },
    { price: 499, originalPrice: undefined, discountPercent: 0, stock: 1, variants: ["Standard"], reviewCount: 2, ratingAvg: 5 },
    { price: 9999999999.99, originalPrice: undefined, discountPercent: 0, stock: 0, variants: ["Standard", "Large"], reviewCount: 0 },
    { price: 123, originalPrice: undefined, discountPercent: 0, stock: 12, reviewCount: 9999, ratingAvg: 4.2 },
    { price: 1199, originalPrice: 1500, discountPercent: 20, stock: 2, reviewCount: 0 },
    { price: 432432, originalPrice: undefined, discountPercent: 0, stock: 8, reviewCount: 1, ratingAvg: 4 },
    { price: 323, originalPrice: 435, discountPercent: 26, stock: 5, reviewCount: 0 },
  ];
  return overrides.map((patch, index) => {
    const source = products[index % products.length];
    const actualId = String(source._id || source.id);
    return { ...source, _id: `card-design-${index}-${actualId}`, id: `card-design-${index}-${actualId}`,
      href: source.href || `/products/${actualId}`, variants: [], inStock: true, ...patch };
  });
}

async function layoutCheck(page, viewport, expectedCount, label) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const cards = page.locator("main [data-product-card]");
  await eventually(async () => assert.equal(await cards.count(), expectedCount), `${label}: product cards load`, 60000);
  const measurements = await cards.evaluateAll((elements) => elements.map((card) => {
    const box = card.getBoundingClientRect();
    const fields = {};
    for (const name of ["image", "category", "title", "price", "current-price", "original-price", "stock", "reviews", "actions"]) {
      const element = card.querySelector(`[data-product-${name}]`);
      if (!element) continue;
      const field = element.getBoundingClientRect();
      fields[name] = { y: field.y - box.y, height: field.height, x: field.x, right: field.right, width: field.width, client: element.clientWidth, scroll: element.scrollWidth };
    }
    const action = card.querySelector("[data-product-actions] button, [data-product-actions] a");
    const actionBox = action?.getBoundingClientRect();
    const image = card.querySelector("[data-product-image] img");
    return { x: box.x, right: box.right, y: box.y, width: box.width, height: box.height, client: card.clientWidth, scroll: card.scrollWidth,
      fields, actionHeight: actionBox?.height, actionWidth: actionBox?.width, imageFit: image ? getComputedStyle(image).objectFit : null,
      imageTransform: image ? getComputedStyle(image).transform : null, titleClamp: getComputedStyle(card.querySelector("[data-product-title]")).webkitLineClamp };
  }));
  const rows = [];
  for (const card of measurements) {
    let row = rows.find((items) => Math.abs(items[0].y - card.y) < 2);
    if (!row) rows.push(row = []);
    row.push(card);
    assert.ok(card.x >= -1 && card.right <= viewport.width + 1 && card.scroll <= card.client + 1, `${label}: card stays within horizontal bounds`);
    assert.ok(Math.abs(card.actionHeight - 46) <= 1, `${label}: action is46px, got${card.actionHeight}`);
    assert.ok(Math.abs(card.actionWidth - card.fields.actions.width) <= 1, `${label}: action fills its content width`);
    assert.ok(card.imageFit === null || card.imageFit === "contain", `${label}: product image uses contain`);
    assert.equal(card.titleClamp, "2", `${label}: title is limited to two readable lines`);
    for (const field of ["image", "category", "title", "price", "current-price", "stock", "actions"]) {
      assert.ok(card.fields[field], `${label}: ${field} region exists`);
      assert.ok(card.fields[field].x >= card.x - 1 && card.fields[field].right <= card.right + 1, `${label}: ${field} stays within card`);
      assert.ok(card.fields[field].scroll <= card.fields[field].client + 1, `${label}: ${field} has no horizontal clipping`);
    }
  }
  if (viewport.columns) assert.equal(rows[0].length, viewport.columns, `${label}: expected responsive columns`);
  for (const row of rows) {
    const spread = (values) => Math.max(...values) - Math.min(...values);
    assert.ok(spread(row.map((card) => card.height)) <= 1, `${label}: all cards in a row have equal heights`);
    for (const field of ["image", "category", "title", "price", "current-price", "original-price", "stock", "reviews", "actions"]) {
      const present = row.map((card) => card.fields[field]).filter(Boolean);
      if (present.length < 2) continue;
      assert.ok(spread(present.map((region) => region.y)) <= 1, `${label}: ${field} aligns across the row`);
      if (!["current-price", "original-price"].includes(field)) assert.ok(spread(present.map((region) => region.height)) <= 1, `${label}: ${field} reserves equal height across the row`);
    }
  }
  if (viewport.width >= 768 && viewport.columns) assert.ok(measurements.every((card) => card.width >= 215 && card.width <= 265), `${label}: practical desktop/tablet card widths: ${measurements.map((card) => card.width).join(",")}`);
  if (viewport.width >= 360 && viewport.width <= 639) assert.ok(measurements.every((card) => card.width >= 154), `${label}: mobile cards retain readable width: ${measurements.map((card) => card.width).join(",")}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: page has no horizontal overflow`);
  return { cards, measurements, rowColumns: rows.map((row) => row.length) };
}

async function main() {
  const productResponse = await fetch(`${base}/api/products?sort=newest&page=1&limit=12`);
  assert.equal(productResponse.status, 200);
  const actualPayload = await productResponse.json();
  const actualProducts = actualPayload.products;
  assert.ok(actualProducts.length >= 6, "Actual catalog is available");
  const categories = await (await fetch(`${base}/api/categories`)).json();
  const fixtures = fixturesFrom(actualProducts);
  const screenshots = await fs.mkdtemp(path.join(os.tmpdir(), "joro-product-cards-"));
  const browser = await chromium.launch({ executablePath: process.env.PRODUCT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  const results = [];
  try {
    for (const viewport of viewports.filter(({ width }) => !requestedWidths || requestedWidths.includes(width))) {
      const { width, height } = viewport;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 768 });
      await context.route((url) => url.pathname === "/api/products", (route) => route.fulfill({ json: { products: fixtures, total: fixtures.length, page: 1, totalPages: 1 } }));
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(90000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/products`, { waitUntil: "domcontentloaded" });
      await eventually(async () => assert.equal(await page.getByRole("navigation", { name: "Category strip", exact: true }).getByRole("link").count(), categories.length), "Real header queries finish alongside the intercepted products", 60000);
      await eventually(async () => assert.ok(await page.evaluate(() => localStorage.getItem("irb-cart") !== null)), "Guest cart storage finishes session initialization", 60000);
      const readyCards = page.locator("main [data-product-card]");
      await eventually(async () => assert.equal(await readyCards.count(), fixtures.length), "Fixture products load", 60000);
      for (const index of [0, 4, 8, 11]) await readyCards.nth(index).scrollIntoViewIfNeeded();
      await eventually(async () => assert.ok(await readyCards.locator("[data-product-image] img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))), "Actual catalog images load before measurements", 60000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const { cards, rowColumns } = await layoutCheck(page, viewport, fixtures.length, `${width}px fixture listing`);
      if (layoutOnly) {
        await page.screenshot({ path: path.join(screenshots, `products-${width}x${height}.png`), fullPage: true });
        await page.screenshot({ path: path.join(screenshots, `products-${width}x${height}-viewport.png`) });
        assert.deepEqual(errors, [], "No browser runtime errors after font/image loading");
        results.push({ viewport: `${width}x${height}`, rowColumns });
        await context.close();
        console.log(`PASS ${width}px: fonts/images loaded before layout and price measurement`);
        continue;
      }
      const initialStyles = await cards.first().evaluate((card) => ({ card: getComputedStyle(card).transform, button: getComputedStyle(card.querySelector("[data-product-actions] button")).transform }));
      await cards.first().hover();
      await page.waitForTimeout(250);
      const hoveredStyles = await cards.first().evaluate((card) => ({ card: getComputedStyle(card).transform, button: getComputedStyle(card.querySelector("[data-product-actions] button")).transform }));
      assert.deepEqual(hoveredStyles, initialStyles, "Hover does not move cards or actions");
      await cards.first().locator("[data-product-actions] button").hover();
      assert.equal(await cards.first().locator("[data-product-actions] button").evaluate((button) => getComputedStyle(button).transform), initialStyles.button, "Button hover does not move the action");
      assert.equal(await cards.locator("a button").count(), 0, "Wishlist buttons are separate from navigation links");
      assert.ok(await cards.first().getByRole("button", { name: `Save ${fixtures[0].name}`, exact: true }).isVisible(), "Wishlist is visible");
      assert.ok((await cards.first().innerText()).includes("-20%"), "Discount badge is present");
      assert.equal(await cards.nth(1).locator("[data-product-original-price]").innerText().catch(() => ""), "", "Non-discounted product has no original price text");
      assert.ok(await cards.nth(2).getByRole("button", { name: "Out of Stock", exact: true }).isDisabled(), "Out-of-stock action is disabled");
      assert.ok(await cards.nth(7).getByRole("button", { name: "Out of Stock", exact: true }).isDisabled(), "Out-of-stock variant product cannot navigate to an available action");
      assert.equal(await cards.nth(5).getByRole("link", { name: "View Options", exact: true }).getAttribute("href"), fixtures[5].href, "Variant products link to their detail page");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: path.join(screenshots, `products-${width}x${height}.png`), fullPage: true });
      console.log(`SCREENSHOT ${path.join(screenshots, `products-${width}x${height}.png`)}`);

      if (width === 1440 || width === 390) {
        const add = cards.first().locator("[data-product-actions] button");
        await add.click();
        await eventually(async () => assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("irb-cart") || "[]").find((line) => line.productId === id)?.quantity, fixtures[0]._id), 1), "Guest cart receives product");
        if (await add.isEnabled()) await add.click();
        if (await add.isEnabled()) await add.click();
        await eventually(async () => assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("irb-cart") || "[]").find((line) => line.productId === id)?.quantity, fixtures[0]._id), 2), "Guest cart quantity respects stock cap");
        await cards.nth(6).getByRole("button", { name: /Add to Cart/i }).click();
        await eventually(async () => assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("irb-cart") || "[]").find((line) => line.productId === id)?.variant, fixtures[6]._id), "Standard"), "Single variant is preserved in cart");
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      const reduced = await cards.first().evaluate((card) => [card, ...card.querySelectorAll("img, button")].map((element) => ({ transition: getComputedStyle(element).transitionDuration, animation: getComputedStyle(element).animationDuration })));
      assert.ok(reduced.every((style) => style.transition.split(",").every((duration) => parseFloat(duration) <= 0.01) && style.animation.split(",").every((duration) => parseFloat(duration) <= 0.01)), "Reduced motion removes card/image/button animation");
      if (width === 1440 || width === 390) {
        await cards.nth(5).getByRole("link", { name: "View Options", exact: true }).click();
        await page.waitForURL((url) => url.pathname === new URL(fixtures[5].href, base).pathname);
      }
      assert.deepEqual(errors, [], "No browser runtime errors in fixture layouts");
      results.push({ viewport: `${width}x${height}`, rowColumns });
      await context.close();
      console.log(`PASS ${width}px: fixture alignment, prices, title, stock, actions, hover, reduced motion`);
    }

    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 768 });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(90000);
      await page.goto(`${base}/products`, { waitUntil: "domcontentloaded" });
      const actualCards = page.locator("main [data-product-card]");
      await eventually(async () => assert.equal(await actualCards.count(), actualProducts.length), "Real products load", 60000);
      for (const index of [0, 4, 8, actualProducts.length - 1]) await actualCards.nth(index).scrollIntoViewIfNeeded();
      await eventually(async () => assert.ok(await actualCards.locator("[data-product-image] img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))), "Real product listing images finish loading", 60000);
      await layoutCheck(page, viewports.find((viewport) => viewport.width === width), actualProducts.length, `${width}px real product listing`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: path.join(screenshots, `real-products-${width}.png`) });
      await page.screenshot({ path: path.join(screenshots, `real-products-${width}-full.png`), fullPage: true });
      console.log(`SCREENSHOT ${path.join(screenshots, `real-products-${width}.png`)}`);
      if (!layoutOnly) {
      const filterSuffix = width >= 1024 ? "desktop" : "mobile";
      const category = categories.find((category) => category.name === actualProducts[0].category) || categories[0];
      await page.locator(`#category-${filterSuffix}`).click();
      const categoryRequest = page.waitForRequest((request) => { const url = new URL(request.url()); return url.pathname === "/api/products" && url.searchParams.get("category") === category.name; });
      await page.getByRole("option", { name: category.name, exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get("category") === category.name);
      await categoryRequest;
      await page.locator(`#sort-${filterSuffix}`).click();
      const sortRequest = page.waitForRequest((request) => { const url = new URL(request.url()); return url.pathname === "/api/products" && url.searchParams.get("sort") === "price_asc" && url.searchParams.get("category") === category.name; });
      await page.getByRole("option", { name: "Price: Low to High", exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get("sort") === "price_asc");
      await sortRequest;
      await eventually(async () => assert.ok(await actualCards.count()), "Filtered products load");
      assert.equal(await page.locator(`#category-${filterSuffix}`).getAttribute("aria-expanded"), "false");
      const saveButton = actualCards.first().getByRole("button", { name: /^Save / });
      await saveButton.click();
      await page.waitForURL((url) => url.pathname === "/login" && url.searchParams.get("mode") === "signin");
      assert.ok(new URL(page.url()).searchParams.get("callbackUrl").includes("/products"), "Guest wishlist keeps return route");
      }
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await eventually(async () => assert.ok(await page.locator("main [data-product-card]").count()), "Shared cards render on homepage", 60000);
      const homeCount = await page.locator("main [data-product-card]").count();
      await layoutCheck(page, { width, height: 900 }, homeCount, `${width}px real homepage`);
      await page.screenshot({ path: path.join(screenshots, `home-products-${width}.png`), fullPage: true });
      await context.close();
      console.log(`PASS ${width}px: ${layoutOnly ? "loaded real listing and homepage layout" : "actual category/sort filtering, wishlist login route, shared homepage cards"}`);
    }
    const narrowHomeContext = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true });
    const narrowHomePage = await narrowHomeContext.newPage();
    await narrowHomePage.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
    await eventually(async () => assert.ok(await narrowHomePage.locator("main [data-product-card]").count()), "Nested homepage cards load at360px", 60000);
    await layoutCheck(narrowHomePage, { width: 360, height: 800 }, await narrowHomePage.locator("main [data-product-card]").count(), "360px real homepage nested grids");
    await narrowHomePage.screenshot({ path: path.join(screenshots, "home-products-360.png"), fullPage: true });
    await narrowHomeContext.close();
    console.log("PASS360px: nested homepage grids preserve readable card widths");
    console.log(JSON.stringify({ status: "passed", screenshots, results }, null, 2));
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
