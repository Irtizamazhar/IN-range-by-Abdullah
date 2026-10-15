import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

try {
  for (const width of [360, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto("http://localhost:3460", { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: "Add to Cart" }).first();
    await button.waitFor();
    await page.waitForTimeout(700);
    await button.click();
    await page.getByText("Added ✓", { exact: true }).first().waitFor();
    const toast = page.getByText("Added to cart successfully!", { exact: true });
    await toast.waitFor();
    assert.equal(await toast.count(), 1);
    const box = await toast.boundingBox();
    assert.ok(box && box.y < 120 && box.x >= 0 && box.x + box.width <= width, `toast visible near top at ${width}px`);
    await toast.waitFor({ state: "detached", timeout: 5000 });
    console.log(`PASS home Add to Cart toast at ${width}px`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://localhost:3460/products", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const detailHref = await page.locator('article[data-product-card] a[href^="/products/"]').first().getAttribute("href");
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
  await page.getByText("Added to cart successfully!", { exact: true }).waitFor();
  assert.equal(await page.getByText("Added to cart successfully!", { exact: true }).count(), 1);
  console.log("PASS product listing Add to Cart toast");
  await page.close();

  assert.ok(detailHref, "listing has a product detail link");
  const detail = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await detail.route("**/api/auth/session", route => route.fulfill({ json: {
    user: { id: "browser-test-customer", role: "customer", name: "Test customer" },
    expires: "2099-01-01T00:00:00.000Z",
  } }));
  await detail.goto(`http://localhost:3460${detailHref}`, { waitUntil: "domcontentloaded" });
  await detail.getByRole("button", { name: "Add to Cart" }).first().waitFor();
  await detail.waitForTimeout(700);
  await detail.getByRole("button", { name: "Add to Cart" }).first().click();
  await detail.getByText("Added ✓", { exact: true }).waitFor();
  await detail.getByText("Added to cart successfully!", { exact: true }).waitFor();
  console.log("PASS product detail Add to Cart toast with mocked customer session");
  await detail.close();
} finally {
  await browser.close();
}
