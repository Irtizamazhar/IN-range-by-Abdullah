import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = "http://localhost:3462";
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });

try {
  const good = await browser.newPage();
  const legitimate = await good.request.post(`${base}/api/customer/register`, { headers: { origin: base }, data: {} });
  assert.equal(legitimate.status(), 400, "same-origin signup reaches field validation");
  const denied = await good.request.post(`${base}/api/customer/register`, { headers: { origin: "https://evil.example" }, data: {} });
  assert.equal(denied.status(), 403, "unauthorized origin is rejected");
  await good.close();

  for (const width of [360, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    page.setDefaultTimeout(30000);
    await page.goto(`${base}/login?role=customer&mode=signup`, { waitUntil: "domcontentloaded" });
    const form = page.locator("form").first();
    await form.getByLabel("Full Name").waitFor();
    await form.getByLabel("Full Name").fill("Preview Customer");
    await form.getByLabel("Email").fill("preview@example.com");
    const password = form.getByLabel("Password", { exact: true });
    await password.fill("abc");
    await page.getByText("Password strength: Weak").waitFor();
    await password.fill("Abcdef12");
    await page.getByText("Password strength: Medium").waitFor();
    await password.fill("Abcdef123!");
    await page.getByText("Password strength: Strong").waitFor();
    await page.getByRole("link", { name: "Terms & Conditions" }).click();
    await page.waitForURL("**/terms-and-conditions");
    await page.goBack();
    await form.getByLabel("Full Name").waitFor();
    assert.equal(await form.getByLabel("Full Name").inputValue(), "Preview Customer");
    assert.equal(await form.getByLabel("Email").inputValue(), "preview@example.com");
    assert.equal(await form.getByLabel("Password", { exact: true }).inputValue(), "");
    await page.getByText(/Re-enter your password to continue/).waitFor();
    assert.equal(await page.getByRole("tab", { name: "Customer" }).getAttribute("aria-selected"), "true");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`PASS signup terms/back and password strength at ${width}px`);
    await page.close();
  }

  for (const width of [360, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    page.setDefaultTimeout(30000);
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const card = page.locator("article[data-product-card]").first();
    await card.waitFor();
    await page.waitForTimeout(500);
    const href = await card.locator("a[href^='/products/']").first().getAttribute("href");
    assert.ok(href);
    for (const selector of ["a[aria-hidden='true']", "span[title^='Rs.']"]) {
      const target = card.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      assert.ok(box);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForURL(`**${href}`);
      await page.goBack();
      await card.waitFor();
      await page.waitForTimeout(300);
    }
    const cart = card.getByRole("button", { name: "Add to Cart" });
    await cart.click();
    await card.getByText("Added ✓", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    console.log(`PASS home card navigation and independent cart at ${width}px`);
    await page.close();
  }

  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    page.setDefaultTimeout(30000);
    await page.goto(`${base}/products`, { waitUntil: "domcontentloaded" });
    const card = page.locator("article[data-product-card]").first();
    await card.waitFor();
    await page.waitForTimeout(500);
    const href = await card.locator("a[href^='/products/']").first().getAttribute("href");
    assert.ok(href);
    for (const selector of ["[data-product-image]", "a[title]", "[data-product-price]", "[role='img']"]) {
      const target = card.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      assert.ok(box);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForURL(`**${href}`);
      await page.goBack();
      await card.waitFor();
      await page.waitForTimeout(250);
    }
    const actions = card.locator("[data-product-actions]");
    await actions.scrollIntoViewIfNeeded();
    const gap = await actions.boundingBox();
    assert.ok(gap);
    await page.mouse.click(gap.x + 4, gap.y - 3);
    await page.waitForURL(`**${href}`);
    await page.goBack();
    await card.waitFor();
    await page.waitForTimeout(250);
    await card.getByRole("button", { name: "Add to Cart" }).click();
    await card.getByText("Added ✓", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/products");
    console.log(`PASS listing image/title/price/rating/space/cart at ${width}px`);
    await page.close();
  }

  for (const width of [360, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    await page.goto(`${base}/products`, { waitUntil: "domcontentloaded" });
    const href = await page.locator("article[data-product-card] a[href^='/products/']").first().getAttribute("href");
    assert.ok(href);
    await page.goto(`${base}${href}`, { waitUntil: "domcontentloaded" });
    const buy = page.getByRole("button", { name: "Buy Now" });
    const add = page.getByRole("button", { name: "Add to Cart" }).first();
    await buy.waitFor();
    const buyBox = await buy.boundingBox();
    const addBox = await add.boundingBox();
    assert.ok(buyBox && addBox);
    assert.ok(buyBox.height >= 48 && addBox.height >= 48);
    assert.ok(Math.abs(buyBox.width - addBox.width) <= 2);
    assert.ok(buyBox.x >= 0 && addBox.x + addBox.width <= width);
    console.log(`PASS balanced product detail buttons at ${width}px`);
    await page.close();
  }

  const variant = await browser.newPage({ viewport: { width: 390, height: 850 } });
  await variant.route("**/api/products?*", route => route.fulfill({ json: {
    products: [{ _id: "variant-fixture", name: "Variant Test Product", price: 1000, images: [], category: "Test", variants: ["Small", "Large"], stock: 5 }],
    total: 1, totalPages: 1, priceRange: { min: 1000, max: 1000 },
  } }));
  await variant.goto(`${base}/products`, { waitUntil: "domcontentloaded" });
  const option = variant.getByRole("link", { name: /Select Options/ }).first();
  await option.waitFor();
  await option.click();
  await variant.waitForURL("**/products/variant-fixture");
  console.log("PASS variant product Select Options opens detail");
  await variant.close();
} finally {
  await browser.close();
}
