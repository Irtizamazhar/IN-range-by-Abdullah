/** Read-only browser regression against the running storefront and its real catalog. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");

const base = process.env.CATEGORY_TEST_URL || "http://localhost:3000";
const requestedWidths = process.argv[2]?.split(",").map(Number);
const viewports = [
  { width: 1440, height: 900, columns: 5 },
  { width: 1024, height: 768, columns: 4 },
  { width: 768, height: 1024, columns: 3 },
  { width: 390, height: 844, columns: 2 },
  { width: 320, height: 568, columns: 2 },
  { width: 844, height: 390, columns: 3 },
];

async function eventually(check, description, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let error;
  do {
    try { await check(); return; } catch (caught) { error = caught; }
    await new Promise((resolve) => setTimeout(resolve, 80));
  } while (Date.now() < deadline);
  throw new Error(description, { cause: error });
}

async function main() {
  const response = await fetch(`${base}/api/categories`);
  assert.equal(response.status, 200, "Real category API is available");
  const categories = await response.json();
  assert.ok(Array.isArray(categories) && categories.length, "Real catalog has categories");
  const screenshots = await fs.mkdtemp(path.join(os.tmpdir(), "joro-category-menu-"));
  const browser = await chromium.launch({
    executablePath: process.env.CATEGORY_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const results = [];
  try {
    for (const viewport of viewports.filter(({ width }) => !requestedWidths || requestedWidths.includes(width))) {
      const { width, height, columns } = viewport;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1024 });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(90000);
      const errors = [];
      const networkErrors = [];
      const pending = new Set();
      page.on("request", (request) => pending.add(request.url()));
      page.on("requestfinished", (request) => pending.delete(request.url()));
      page.on("requestfailed", (request) => pending.delete(request.url()));
      page.on("requestfailed", (request) => networkErrors.push({ url: request.url(), failure: request.failure() }));
      page.on("response", (response) => { if (response.status() >= 400) networkErrors.push({ url: response.url(), status: response.status() }); });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base, { waitUntil: "domcontentloaded" });
      const trigger = page.getByRole("button", { name: "Categories", exact: true });
      const panel = page.locator("#category-dropdown");
      const categoryLinks = page.getByRole("navigation", { name: "All categories", exact: true }).getByRole("link");
      const search = page.locator('header input[type="search"]');
      try {
        await eventually(async () => {
          assert.equal(await page.getByRole("navigation", { name: "Category strip", exact: true }).getByRole("link").count(), categories.length);
        }, "Header categories loaded from real API", 60000);
      } catch (error) {
        await page.screenshot({ path: path.join(screenshots, `failure-${width}x${height}.png`) });
        console.error(JSON.stringify({ screenshots, errors, networkErrors, pending: [...pending], readyState: await page.evaluate(() => document.readyState), page: (await page.locator("body").innerText()).slice(0, 600), api: await page.evaluate(async () => { const response = await fetch("/api/categories"); return { status: response.status, body: (await response.text()).slice(0, 600) }; }) }));
        throw error;
      }
      const originalOverflow = await page.evaluate(() => ({ body: document.body.style.overflow, html: document.documentElement.style.overflow }));
      const activate = () => width < 768 ? trigger.tap() : trigger.click();
      const open = async () => {
        await activate();
        await panel.waitFor({ state: "visible" });
        await eventually(async () => assert.equal(await trigger.getAttribute("aria-expanded"), "true"), "Trigger expands");
      };
      const closed = async () => {
        await panel.waitFor({ state: "hidden" });
        assert.equal(await trigger.getAttribute("aria-expanded"), "false");
        await eventually(async () => assert.deepEqual(await page.evaluate(() => ({ body: document.body.style.overflow, html: document.documentElement.style.overflow })), originalOverflow), "Scroll lock restored");
      };
      const closedChevron = await trigger.locator("svg").last().evaluate((element) => getComputedStyle(element).transform);
      await open();
      await eventually(async () => assert.equal(await categoryLinks.count(), categories.length), "All real categories displayed");
      assert.deepEqual(await categoryLinks.allTextContents(), categories.map((category) => category.name), "Real order and names preserved");
      assert.deepEqual(await categoryLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))), categories.map((category) => `/products?category=${encodeURIComponent(category.name)}`), "All real routes preserved");
      await eventually(async () => assert.notEqual(await trigger.locator("svg").last().evaluate((element) => getComputedStyle(element).transform), closedChevron), "Chevron changes when open");
      assert.equal(await search.count(), 1, "Only the existing search remains");
      assert.ok(await search.isVisible(), "Header search stays visible");
      assert.ok(await page.locator('header img[alt="JORO"]').first().isVisible(), "Logo stays visible");
      assert.ok(await panel.getByRole("heading", { name: "Shop by Category", exact: true }).isVisible());
      assert.ok(await panel.getByRole("button", { name: "Close categories", exact: true }).isVisible());
      const geometry = await panel.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const nav = element.querySelector('nav[aria-label="All categories"]');
        return { x: box.x, right: box.right, top: box.top, bottom: box.bottom, width: box.width,
          columns: getComputedStyle(nav).gridTemplateColumns.split(" ").length,
          pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight };
      });
      const triggerBox = await trigger.boundingBox();
      assert.equal(geometry.columns, columns, `Responsive ${columns}-column grid`);
      assert.ok(geometry.x >= -1 && geometry.right <= width + 1, "Panel stays inside viewport horizontally");
      assert.ok(geometry.width >= width * 0.85, "Panel spans the page");
      assert.ok(geometry.top >= triggerBox.y + triggerBox.height - 1 && geometry.top <= triggerBox.y + triggerBox.height + 16, "Panel is directly under the category bar");
      assert.ok(geometry.bottom <= height + 1, "Panel fits available viewport height");
      assert.ok(geometry.pageWidth <= geometry.viewportWidth + 1, "Page has no horizontal overflow");
      const linkBounds = await categoryLinks.evaluateAll((links) => links.map((link) => {
        const box = link.getBoundingClientRect();
        return { x: box.x, right: box.right, client: link.clientWidth, scroll: link.scrollWidth };
      }));
      assert.ok(linkBounds.every((link) => link.x >= -1 && link.right <= width + 1 && link.scroll <= link.client + 1), "Category names fit their links");
      const entryStyles = await categoryLinks.evaluateAll((links) => links.map((link) => {
        const style = getComputedStyle(link);
        const media = link.querySelector("[data-category-image]") || link.firstElementChild;
        const name = link.querySelector("[data-category-name]") || link.children[1];
        const nameStyle = getComputedStyle(name);
        const mediaBox = media.getBoundingClientRect();
        return { border: style.borderTopWidth, radius: style.borderTopLeftRadius, background: style.backgroundColor,
          mediaWidth: mediaBox.width, mediaHeight: mediaBox.height, mediaContent: !!media.querySelector("img, svg"),
          imageSource: media.querySelector("img")?.getAttribute("src") || null,
          nameWeight: nameStyle.fontWeight, nameWrap: nameStyle.whiteSpace, nameClamp: nameStyle.webkitLineClamp };
      }));
      assert.ok(entryStyles.every((entry) => parseFloat(entry.border) > 0 && parseFloat(entry.radius) >= 8 && entry.background === "rgb(255, 255, 255)"), `Category cards have white backgrounds, subtle borders, and rounded corners: ${JSON.stringify(entryStyles)}`);
      assert.ok(entryStyles.every((entry) => Math.abs(entry.mediaWidth - 48) < 0.1 && Math.abs(entry.mediaHeight - 48) < 0.1 && entry.mediaContent), "Every category has a uniform48px real image or fallback icon");
      assert.ok(entryStyles.every((entry) => Number(entry.nameWeight) >= 600 && entry.nameWrap !== "nowrap" && entry.nameClamp === "none"), "Category names use readable semibold text and wrap without truncation");
      entryStyles.forEach((entry, index) => {
        if (!entry.imageSource) return;
        const imageURL = new URL(entry.imageSource, base);
        assert.ok(imageURL.href === new URL(categories[index].image.trim(), base).href || imageURL.searchParams.get("url") === categories[index].image.trim(), `Cards use the actual category image from the API: ${JSON.stringify({ category: categories[index].name, expected: categories[index].image, actual: entry.imageSource })}`);
      });
      await eventually(async () => assert.ok(await categoryLinks.evaluateAll((links) => links.every((link) => {
        const image = link.querySelector("img");
        const box = link.getBoundingClientRect();
        return !image || box.top >= innerHeight || (image.complete && image.naturalWidth > 0);
      }))), "Visible category images load or use fallback icons");
      if (width >= 1024) {
        await categoryLinks.first().hover();
        await eventually(async () => {
          const hover = await categoryLinks.first().evaluate((element) => {
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, border: style.borderTopColor, lift: new DOMMatrixReadOnly(style.transform).m42 };
          });
          const background = hover.background.match(/\d+/g).map(Number);
          const border = hover.border.match(/\d+/g).map(Number);
          assert.ok(background[0] > 200 && background[1] > background[2] && background[1] >= background[0], "Desktop hover has a light lime background");
          assert.ok(border[0] < 80 && border[1] > border[0] && border[1] > border[2] && border[1] < 160, "Desktop hover has a dark green border");
          assert.ok(hover.lift < 0 && hover.lift >= -4, "Desktop hover gives a gentle lift");
        }, "Desktop card hover is visible");
        await trigger.hover();
        await page.waitForTimeout(200);
      }
      await page.screenshot({ path: path.join(screenshots, `categories-${width}x${height}.png`) });
      console.log(`SCREENSHOT ${path.join(screenshots, `categories-${width}x${height}.png`)}`);

      // Content scrolls beneath the fixed panel heading without moving the page.
      const scroller = page.locator("[data-category-scroll]");
      const scrollMetrics = await scroller.evaluate((element) => ({ client: element.clientHeight, scroll: element.scrollHeight }));
      const heading = panel.getByRole("heading", { name: "Shop by Category", exact: true });
      const headingBefore = await heading.boundingBox();
      const pageY = await page.evaluate(() => scrollY);
      if (scrollMetrics.scroll > scrollMetrics.client + 1) {
        await scroller.hover();
        await page.mouse.wheel(0, 2000);
        await eventually(async () => assert.ok(await scroller.evaluate((element) => element.scrollTop > 0)), "Category area scrolls");
        await categoryLinks.last().scrollIntoViewIfNeeded();
        const lastBox = await categoryLinks.last().boundingBox();
        assert.ok(lastBox.y + lastBox.height <= height + 1, "Last category is reachable");
        assert.ok(Math.abs((await heading.boundingBox()).y - headingBefore.y) <= 1, "Heading remains fixed while categories scroll");
        assert.equal(await page.evaluate(() => scrollY), pageY, "Category scrolling does not move background");
        if (width < 1024) {
          await scroller.evaluate((element) => { element.scrollTop = 0; });
          const touch = await context.newCDPSession(page);
          const scrollBox = await scroller.boundingBox();
          const touchX = Math.round(scrollBox.x + scrollBox.width / 2);
          const touchStartY = Math.round(scrollBox.y + scrollBox.height * 0.8);
          const touchEndY = Math.round(scrollBox.y + scrollBox.height * 0.2);
          await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchX, y: touchStartY }] });
          for (let step = 1; step <= 6; step++) {
            await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchX, y: touchStartY + (touchEndY - touchStartY) * step / 6 }] });
            await page.waitForTimeout(40);
          }
          await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await eventually(async () => assert.ok(await scroller.evaluate((element) => element.scrollTop > 0)), "Touch swipe scrolls categories");
          assert.equal(await page.evaluate(() => scrollY), pageY, "Touch swipe does not move the background");
          await touch.detach();
        }
      }
      await search.hover();
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => scrollY), pageY, "Background wheel scrolling is locked");
      await panel.getByRole("button", { name: "Close categories", exact: true }).click();
      await closed();
      assert.equal(await trigger.evaluate((element) => document.activeElement === element), true, "Close returns focus to trigger");

      await open();
      await activate();
      await closed();
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      await panel.waitFor({ state: "visible" });
      await eventually(async () => assert.ok(await panel.evaluate((element) => element.contains(document.activeElement))), "Keyboard open moves focus into menu");
      assert.ok(await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return parseFloat(style.outlineWidth) >= 2 && style.outlineStyle !== "none" && style.outlineColor !== "rgba(0, 0, 0, 0)";
      }), "Keyboard navigation has a visible focus outline");
      await page.keyboard.press("Tab");
      assert.ok(await panel.evaluate((element) => element.contains(document.activeElement)), "Tab navigates panel actions");
      await page.keyboard.press("Escape");
      await closed();
      assert.ok(await trigger.evaluate((element) => document.activeElement === element), "Escape restores trigger focus");

      await open();
      await categoryLinks.last().focus();
      await page.keyboard.press("Tab");
      await closed();
      assert.ok(await page.getByRole("navigation", { name: "Category strip", exact: true }).getByRole("link").first().evaluate((element) => document.activeElement === element), "Tab from final category closes and returns to category strip");
      await open();
      const allProducts = panel.getByRole("link", { name: "All Products", exact: true });
      await allProducts.focus();
      await page.keyboard.press("Shift+Tab");
      assert.ok(await trigger.evaluate((element) => document.activeElement === element), "Shift+Tab from first action returns to trigger");
      await page.keyboard.press("Tab");
      assert.ok(await allProducts.evaluate((element) => document.activeElement === element), "Tab from expanded trigger enters first menu action");
      await page.keyboard.press("Escape");
      await closed();

      await open();
      const outsidePanel = await panel.boundingBox();
      if (outsidePanel.y + outsidePanel.height + 10 < height) {
        await categoryLinks.first().focus();
        await page.mouse.click(width / 2, outsidePanel.y + outsidePanel.height + 8);
        await closed();
        assert.ok(await trigger.evaluate((element) => document.activeElement === element), "Backdrop dismissal restores trigger focus");
        await open();
      }
      await search.click();
      await closed();
      assert.ok(await search.evaluate((element) => document.activeElement === element), "Header search remains usable and closes menu");
      await search.fill("jo");
      assert.equal(await search.inputValue(), "jo");
      await search.fill("");

      // The existing header leaves the viewport on a deep page scroll. Start
      // with its trigger visibly reachable so Playwright does not auto-scroll it.
      await page.evaluate(() => window.scrollTo({ top: 60, behavior: "instant" }));
      await trigger.scrollIntoViewIfNeeded();
      const scrolledPageY = await page.evaluate(() => scrollY);
      const triggerBeforeScrollOpen = await trigger.boundingBox();
      assert.ok(scrolledPageY > 0, "Storefront can scroll when menu is closed");
      await open();
      const openScrolledPageY = await page.evaluate(() => scrollY);
      const triggerDuringScrollOpen = await trigger.boundingBox();
      await panel.getByRole("button", { name: "Close categories", exact: true }).click();
      await closed();
      const closedScrolledPageY = await page.evaluate(() => scrollY);
      assert.equal(openScrolledPageY, scrolledPageY, `Opening preserves existing page position: ${JSON.stringify({ before: triggerBeforeScrollOpen, during: triggerDuringScrollOpen })}`);
      assert.equal(closedScrolledPageY, scrolledPageY, "Closing preserves existing page position");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

      if (width === 1440 || width === 390) {
        await open();
        await page.getByRole("button", { name: "Open cart", exact: true }).click();
        await panel.waitFor({ state: "hidden" });
        await eventually(async () => assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden"), "Cart retains its own scroll lock");
        await page.getByRole("button", { name: "Close cart", exact: true }).click();
        await closed();
      }

      // Use real encoded names and check the existing product filtering request.
      await open();
      const selected = categories.find((category) => category.name.includes("&")) || categories[0];
      const filteredRequest = page.waitForRequest((request) => {
        const url = new URL(request.url());
        return url.pathname === "/api/products" && url.searchParams.get("category") === selected.name;
      });
      await categoryLinks.filter({ hasText: selected.name }).click();
      await page.waitForURL((url) => url.pathname === "/products" && url.searchParams.get("category") === selected.name);
      await filteredRequest;
      await closed();
      await open();
      await panel.getByRole("link", { name: "All Products", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/products" && !url.search);
      await closed();
      assert.deepEqual(errors, [], "No browser runtime errors");
      results.push({ viewport: `${width}x${height}`, columns, categories: categories.length, categoryScrolling: scrollMetrics.scroll > scrollMetrics.client + 1 });
      console.log(`PASS ${width}x${height}: layout, actual catalog/routes, toggle, keyboard, outside/header dismissal, scroll lock`);
      await context.close();
    }
    // Make one existing catalog image fail in an isolated browser context.
    // Category data and routes remain real; no demo category is introduced.
    const imageCategory = categories.find((category) => category.image);
    assert.ok(imageCategory, "Catalog has a real image for the fallback check");
    const imageURL = new URL(imageCategory.image, base);
    const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let failedImageRequests = 0;
    await fallbackContext.route((url) => url.href === imageURL.href || (url.pathname === "/_next/image" && url.searchParams.get("url") === imageCategory.image), async (route) => {
      failedImageRequests++;
      await route.fulfill({ status: 404, contentType: "text/plain", body: "Image unavailable during browser verification" });
    });
    const fallbackPage = await fallbackContext.newPage();
    fallbackPage.setDefaultTimeout(15000);
    await fallbackPage.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
    await eventually(async () => assert.equal(await fallbackPage.getByRole("navigation", { name: "Category strip", exact: true }).getByRole("link").count(), categories.length), "Real catalog loaded for image fallback check", 60000);
    await fallbackPage.getByRole("button", { name: "Categories", exact: true }).click();
    const fallbackLink = fallbackPage.getByRole("navigation", { name: "All categories", exact: true }).getByRole("link", { name: imageCategory.name, exact: true });
    const fallbackMedia = fallbackLink.locator("[data-category-image]");
    await eventually(async () => {
      assert.equal(await fallbackMedia.locator("img").count(), 0);
      assert.equal(await fallbackMedia.locator("svg").count(), 1);
    }, "Failed actual category image is replaced by a fallback icon");
    assert.ok(failedImageRequests > 0, "The selected actual image request was exercised");
    const fallbackBox = await fallbackMedia.boundingBox();
    assert.ok(Math.abs(fallbackBox.width - 48) < 0.1 && Math.abs(fallbackBox.height - 48) < 0.1, "Fallback preserves the uniform image dimensions");
    assert.equal(await fallbackLink.getAttribute("href"), `/products?category=${encodeURIComponent(imageCategory.name)}`, "Fallback retains the actual category route");
    await fallbackPage.screenshot({ path: path.join(screenshots, "categories-image-fallback.png") });
    await fallbackContext.close();
    console.log(`PASS actual image404 fallback: ${imageCategory.name}`);
    console.log(JSON.stringify({ status: "passed", screenshots, results }, null, 2));
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
