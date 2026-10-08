/** Read-only browser checks for the reference-inspired homepage marketplace. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");

const base = process.env.MARKETPLACE_TEST_URL || "http://localhost:3001";
const requestedWidths = process.argv.slice(2).find((argument) => !argument.startsWith("--"))?.split(",").map(Number);
const layoutOnly = process.argv.includes("--layout-only");
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 800 },
  { width: 1422, height: 650 },
  { width: 1405, height: 650 },
  { width: 1400, height: 650 },
  { width: 1399, height: 650 },
  { width: 1366, height: 650 },
  { width: 1280, height: 584 },
  { width: 1264, height: 584 },
  { width: 1240, height: 650 },
  { width: 1239, height: 650 },
  { width: 1200, height: 650 },
  { width: 1199, height: 650 },
  { width: 1024, height: 900 },
  { width: 768, height: 1024 },
  { width: 540, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
];

async function eventually(check, description, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let cause;
  do {
    try { await check(); return; } catch (error) { cause = error; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  } while (Date.now() < deadline);
  throw new Error(description, { cause });
}

async function loadedSection(page) {
  const section = page.locator("[data-home-marketplace]");
  await section.waitFor({ state: "visible" });
  const cards = section.locator("[data-product-card]");
  await eventually(async () => assert.equal(await cards.count(), 4), "Four real featured products load");
  console.log("READY featured products rendered");
  for (let index = 0; index < await cards.count(); index++) {
    await eventually(async () => cards.nth(index).scrollIntoViewIfNeeded(), "Product stays mounted after viewport change");
  }
  await eventually(async () => assert.ok(await section.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))), "Featured images finish loading");
  await page.evaluate(() => document.fonts.ready.then(() => true));
  console.log("READY featured images and fonts loaded");
  await eventually(async () => section.scrollIntoViewIfNeeded(), "Marketplace stays mounted after initial hydration");
  return section;
}

async function measureHeader(page, viewport) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const header = await page.evaluate(() => {
    const root = [...document.querySelectorAll("header")].find((element) => element.querySelector('[role="search"]'));
    if (!root) return null;
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const controls = [...root.querySelectorAll("a, button, input")]
      .filter((element) => element.getClientRects().length && element.getBoundingClientRect().width > 0 && !element.closest('[aria-label="Category strip"]'))
      .map((element) => ({ name: element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.textContent.trim(), ...box(element) }));
    const strip = root.querySelector('[aria-label="Category strip"]');
    return { ...box(root), controls, strip: strip ? box(strip) : null, searchCount: root.querySelectorAll('[role="search"]').length };
  });
  assert.ok(header, `${viewport.width}px: website header and existing search are rendered`);
  assert.equal(header.searchCount, 1, `${viewport.width}px: existing search is preserved without duplication`);
  for (const item of [header, header.strip, ...header.controls].filter(Boolean)) {
    assert.ok(item.x >= -1 && item.right <= viewport.width + 1, `${viewport.width}px: header/navigation control stays within viewport: ${item.name || "container"}`);
  }
  for (let index = 0; index < header.controls.length; index++) {
    const control = header.controls[index];
    for (const other of header.controls.slice(index + 1)) {
      const overlapX = Math.min(control.right, other.right) - Math.max(control.x, other.x);
      const overlapY = Math.min(control.bottom, other.bottom) - Math.max(control.y, other.y);
      assert.ok(overlapX <= 1 || overlapY <= 1, `${viewport.width}px: header controls do not overlap: ${control.name}/${other.name}`);
    }
  }
  return header;
}

async function measure(section, viewport) {
  const layout = await section.evaluate((element) => {
    const region = (node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, client: node.clientWidth, scroll: node.scrollWidth };
    };
    return {
      section: region(element),
      heading: region(element.querySelector("#featured-products-heading")),
      viewAll: region(element.querySelector('[data-marketplace-panel="products"] header a')),
      page: { width: innerWidth, scroll: document.documentElement.scrollWidth },
      floating: [...document.querySelectorAll("[data-floating-action]")].map((control) => ({ name: control.getAttribute("data-floating-action"), ...region(control) })),
      mobileNav: (() => { const nav = document.querySelector('[aria-label="Mobile navigation"]'); return nav && nav.getBoundingClientRect().height ? region(nav) : null; })(),
      panels: [...element.querySelectorAll("[data-marketplace-panel]")].map((panel) => ({ name: panel.getAttribute("data-marketplace-panel"), ...region(panel) })),
      cards: [...element.querySelectorAll("[data-product-card]")].map((card) => {
        const fields = {};
        for (const name of ["image", "category", "title", "price", "current-price", "original-price", "stock", "actions"]) {
          const field = card.querySelector(`[data-product-${name}]`);
          if (field) fields[name] = region(field);
        }
        const image = card.querySelector("img");
        const action = card.querySelector("[data-product-actions] button, [data-product-actions] a");
        return { id: card.getAttribute("data-product-card"), ...region(card), fields,
          title: card.querySelector("[data-product-title]")?.textContent,
          imageFit: image ? getComputedStyle(image).objectFit : null,
          imageLink: region(card.querySelector("[data-product-image] a")),
          action: action ? region(action) : null,
          actionLabel: action?.textContent.trim(),
          stock: card.querySelector("[data-product-stock]")?.getAttribute("data-availability"),
          disabled: action instanceof HTMLButtonElement && action.disabled,
          category: card.querySelector("[data-product-category]")?.textContent.trim(),
          currentPrice: card.querySelector("[data-product-current-price]")?.textContent.trim(),
        };
      }),
    };
  });
  const label = `${viewport.width}px`;
  assert.ok(layout.page.scroll <= layout.page.width + 1, `${label}: no page horizontal overflow`);
  const headingOverlapX = Math.min(layout.heading.right, layout.viewAll.right) - Math.max(layout.heading.x, layout.viewAll.x);
  const headingOverlapY = Math.min(layout.heading.bottom, layout.viewAll.bottom) - Math.max(layout.heading.y, layout.viewAll.y);
  assert.ok(headingOverlapX <= 1 || headingOverlapY <= 1, `${label}: Featured Products and View All do not overlap`);
  assert.deepEqual(layout.panels.map((panel) => panel.name), ["products", "wants", "vendors"], `${label}: reference panel ordering is preserved`);
  for (const item of [layout.section, ...layout.panels, ...layout.cards]) {
    assert.ok(item.x >= -1 && item.right <= viewport.width + 1, `${label}: section/panels/cards stay in viewport`);
    assert.ok(item.scroll <= item.client + 1, `${label}: no internal horizontal overflow`);
  }
  for (const [index, panel] of layout.panels.entries()) {
    for (const next of layout.panels.slice(index + 1)) {
      const horizontal = Math.min(panel.right, next.right) - Math.max(panel.x, next.x);
      const vertical = Math.min(panel.bottom, next.bottom) - Math.max(panel.y, next.y);
      assert.ok(horizontal <= 1 || vertical <= 1, `${label}: ${panel.name}/${next.name} panels do not overlap`);
    }
  }
  const rows = [];
  for (const card of layout.cards) {
    let row = rows.find((items) => Math.abs(items[0].y - card.y) < 2);
    if (!row) rows.push(row = []);
    row.push(card);
    assert.equal(card.imageFit, "contain", `${label}: real image preserves its aspect ratio`);
    assert.ok(card.imageLink.height <= 230.5, `${label}: featured image area stays at most230px tall, got${card.imageLink.height}`);
    assert.ok(card.width >= 149 && card.width <= (viewport.width >= 900 ? 265 : 270), `${label}: cards remain readable and bounded, got${card.width}px`);
    assert.ok(card.action && card.action.height >= 46, `${label}: actions retain a readable touch target`);
    assert.ok(Math.abs(card.action.width - card.fields.actions.width) <= 1, `${label}: action fills available card width`);
    for (const [name, field] of Object.entries(card.fields)) {
      assert.ok(field.x >= card.x - 1 && field.right <= card.right + 1, `${label}: ${name} stays inside card`);
      if (name !== "category") assert.ok(field.scroll <= field.client + 1, `${label}: ${name} has no horizontal overflow`);
    }
  }
  const spread = (values) => Math.max(...values) - Math.min(...values);
  for (const row of rows) {
    assert.ok(spread(row.map((card) => card.height)) <= 1, `${label}: cards in a row have equal height`);
    for (const name of ["image", "category", "title", "price", "current-price", "stock", "actions"]) {
      const fields = row.map((card) => card.fields[name]);
      assert.ok(fields.every(Boolean), `${label}: ${name} exists on every card`);
      assert.ok(spread(fields.map((field) => field.y)) <= 1, `${label}: ${name} aligns within a row`);
    }
  }
  if (viewport.width >= 1240) {
    assert.equal(rows[0].length, 4, "Wide desktop shows four featured products in one row");
    assert.ok(spread(layout.panels.map((panel) => panel.y)) <= 1, "Wide desktop shows all three panels side by side");
  }
  if (viewport.width >= 900 && viewport.width < 1240) {
    assert.equal(rows[0].length, 4, "Smaller desktop keeps four bounded product columns");
    assert.ok(layout.panels[1].y >= layout.panels[0].bottom, "Smaller desktop moves side panels below featured products");
  }
  if (viewport.width >= 640 && viewport.width < 900) assert.equal(rows[0].length, 2, "Tablet keeps two bounded product columns");
  if (viewport.width === 390 || viewport.width === 540) assert.equal(rows[0].length, 2, "Mobile uses two readable featured columns");
  if (viewport.width === 320) assert.equal(rows[0].length, 1, "Very narrow mobile uses one featured column");
  assert.equal(layout.floating.length, 2, `${label}: both existing floating controls remain present`);
  for (const control of layout.floating) {
    assert.ok(control.width >= 43 && control.height >= 43, `${label}: floating control keeps a44px touch target`);
    assert.ok(control.x >= 0 && control.right <= viewport.width && control.y >= 0 && control.bottom <= viewport.height, `${label}: floating control stays within viewport`);
    if (viewport.width >= 768) assert.ok(control.x >= Math.max(...layout.panels.map((panel) => panel.right)) + 1, `${label}: ${control.name} has a separate right-side lane`);
    if (layout.mobileNav) assert.ok(control.bottom <= layout.mobileNav.y - 10, `${label}: ${control.name} stays above mobile navigation`);
  }
  const [firstControl, secondControl] = layout.floating;
  const controlOverlapX = Math.min(firstControl.right, secondControl.right) - Math.max(firstControl.x, secondControl.x);
  const controlOverlapY = Math.min(firstControl.bottom, secondControl.bottom) - Math.max(firstControl.y, secondControl.y);
  assert.ok(controlOverlapX <= 0 || controlOverlapY <= 0, `${label}: floating controls do not overlap each other`);
  return { ...layout, rowColumns: rows.map((row) => row.length), compactPanelsFit: layout.panels.every((panel) => panel.y >= 39 && panel.bottom <= viewport.height) };
}

async function checkRealDataAndRoutes(page, section, layout) {
  for (const card of layout.cards) {
    const response = await page.request.get(`${base}/api/products/${encodeURIComponent(card.id)}`, { maxRetries: 3, timeout: 90000 });
    assert.equal(response.status(), 200, `Featured product ${card.id} exists in catalog API`);
    const product = await response.json();
    assert.equal(card.title, product.name, "Product title remains actual catalog content");
    assert.equal(card.currentPrice, `Rs. ${Math.round(Number(product.price)).toLocaleString("en-PK")}`, "Product price remains actual catalog price");
    if (typeof product.stock === "number") {
      assert.equal(card.stock, product.stock > 0 ? "in" : "out", "Product availability accurately reflects real stock");
      if (product.stock <= 0) assert.ok(card.disabled, "Unavailable product action is disabled");
    }
  }
  assert.equal(await section.getByRole("link", { name: "View All", exact: true }).getAttribute("href"), "/products");
  assert.equal(await section.getByRole("link", { name: "Explore Wants", exact: true }).getAttribute("href"), "/wants");
  assert.equal(await section.getByRole("link", { name: "Browse Stores", exact: true }).getAttribute("href"), "/stores");
  const links = await section.locator("a").evaluateAll((anchors) => [...new Set(anchors.map((anchor) => anchor.getAttribute("href")))]);
  for (const href of links) {
    assert.ok(href?.startsWith("/") && !href.startsWith("//"), "Marketplace link stays on its existing internal route");
    const response = await page.request.get(new URL(href, base).href, { maxRetries: 3, timeout: 90000 });
    assert.equal(response.status(), 200, `Real navigation target loads: ${href}`);
    console.log(`PASS real navigation target ${href}`);
  }
  return links;
}

async function main() {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "joro-home-marketplace-"));
  const browser = await chromium.launch({ executablePath: process.env.MARKETPLACE_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  const results = [];
  const selected = viewports.filter(({ width }) => !requestedWidths || requestedWidths.includes(width));
  const context = await browser.newContext({ viewport: selected[0] });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(150000);
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.log(`BROWSER ERROR ${error.message}`); });
  try {
    const response = await page.goto(base, { waitUntil: "domcontentloaded" });
    console.log(`READY homepage response HTTP ${response.status()}`);
    assert.equal(response.status(), 200, "Homepage returns a successful response");
    for (const viewport of selected) {
      await page.setViewportSize(viewport);
      const section = await loadedSection(page);
      const header = await measureHeader(page, viewport);
      await page.screenshot({ path: path.join(output, `homepage-${viewport.width}.png`) });
      await section.evaluate((element, offset) => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - offset, behavior: "instant" }), viewport.width >= 1240 ? 40 : 190);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-floating-action="scroll-top"]').parentElement).opacity === "1");
      const layout = await measure(section, viewport);
      await page.screenshot({ path: path.join(output, `marketplace-${viewport.width}-viewport.png`) });
      await section.screenshot({ path: path.join(output, `marketplace-${viewport.width}.png`) });
      console.log(`SCREENSHOT ${path.join(output, `marketplace-${viewport.width}.png`)}`);
      assert.deepEqual(errors, [], `${viewport.width}px: no browser runtime errors`);
      results.push({ viewport, header, ...layout });
      console.log(`PASS ${viewport.width}px: real cards, panels, images, fonts, bounds, prices and action alignment; columns ${layout.rowColumns.join("/")}; cards ${Math.round(layout.cards[0].width)}px; images ${Math.round(layout.cards[0].fields.image.height)}px; panels ${layout.panels.map((panel) => `${panel.name}:${Math.round(panel.width)}x${Math.round(panel.height)}`).join(" ")}`);
    }
    if (!layoutOnly) {
      const routes = await checkRealDataAndRoutes(page, page.locator("[data-home-marketplace]"), results[0]);
      console.log(`PASS ${routes.length} real navigation routes and catalog product values`);
      results[0].routes = routes;
    }
    assert.deepEqual(errors, [], "No browser runtime errors after verification");
    await fs.writeFile(path.join(output, "measurements.json"), JSON.stringify(results, null, 2));
    console.log(`SCREENSHOTS ${output}`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
    console.error(`FAILURE ${output}\n${(await page.locator("body").innerText().catch(() => "")).slice(0, 3000)}`);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
