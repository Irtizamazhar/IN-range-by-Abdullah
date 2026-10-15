import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright-core";

const base = process.env.JORO_BROWSER_BASE || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.ACCOUNT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().includes("401")) errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400 && !response.url().endsWith("/api/vendor/me")) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.locator("a[href='/services']").first().waitFor();
    await delay(2500);
    const routeRequests = [];
    await page.route("**/*", async route => {
      if (route.request().url().includes("/services")) {
        routeRequests.push({ url: route.request().url(), type: route.request().resourceType(), rsc: route.request().headers()["rsc"], purpose: route.request().headers()["next-router-prefetch"] });
        await delay(1300);
      }
      await route.continue();
    });
    const overlay = page.locator("[data-global-loader='true']");
    const clickPromise = page.locator("a[href='/services']").first().click();
    await delay(350);
    assert.equal(await overlay.count(), 0, "ordinary browsing should not show the branded loader");
    const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(size.scroll <= size.width + 1, `${width}px horizontal overflow`);
    await page.waitForURL("**/services", { timeout: 15000 });
    await clickPromise;
    assert.equal(await overlay.count(), 0);
    const relevantErrors = errors.filter(message => !message.includes("two children with the same key"));
    assert.deepEqual(relevantErrors.map(message => message.slice(0, 200)), [], `${width}px browser errors`);
    console.log(`PASS ${width}px: no branded loader for services, no overflow`);
    if (width === 1440) {
      await page.goBack();
      await page.waitForURL(base + "/");
      await overlay.waitFor({ state: "detached" });
      await page.goForward();
      await page.waitForURL(base + "/services");
      await overlay.waitFor({ state: "detached" });
      console.log("PASS browser back/forward completes without a stuck overlay");
    }
    await page.close();
  }
} finally { await browser.close(); }
