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
    await overlay.waitFor({ timeout: 15000 }).catch(error => { console.log("Overlay diagnostic", { url: page.url(), routeRequests, errors }); throw error; });
    assert.equal(await overlay.getByRole("status").innerText(), "Exploring services...");
    assert.equal(await page.locator("[data-home-marketplace]").count(), 1, "the real homepage should remain behind the overlay");
    const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, ring: document.querySelector("[role='progressbar']")?.getBoundingClientRect().width }));
    assert.ok(size.scroll <= size.width + 1, `${width}px horizontal overflow`);
    assert.equal(size.ring, width < 640 ? 170 : 240);
    if (width === 390 || width === 1440) await page.screenshot({ path: `${process.env.TEMP || "."}/joro-loader-${width}.png`, fullPage: false });
    await page.waitForURL("**/services", { timeout: 15000 });
    await clickPromise;
    await overlay.waitFor({ state: "detached", timeout: 15000 });
    assert.deepEqual(errors, [], `${width}px browser errors`);
    console.log(`PASS ${width}px: services loading text, ring size, no overflow, overlay cleanup`);
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
