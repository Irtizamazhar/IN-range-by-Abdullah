// Render real templates without SMTP, database access or external image requests.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { orderConfirmationEmail, vendorOrderEmail } from "../lib/joro-email-templates";

async function main() {
  process.env.NEXT_PUBLIC_APP_URL = "https://joro.pk";
  const order = { id: "order-test", orderNumber: "JORO-123456", customerName: "Test Customer", createdAt: new Date("2026-10-16T12:00:00Z"), customerAddress: "A long delivery address in Pakistan", city: "Lahore", paymentMethod: "cod", paymentStatus: "pending", totalAmount: 2100, orderItems: [{ name: "Product " + "LongName".repeat(20), quantity: 2, price: 1000, image: "https://joro.pk/product.png" }] };
  const shop = { id: "shop-test", placedAt: order.createdAt, totalAmount: 2000, customerName: order.customerName, customerPhone: "03001234567", customerAddress: order.customerAddress, city: order.city, vendor: { shopName: "Test Store", ownerName: "Test Owner" }, items: [{ productName: order.orderItems[0].name, quantity: 2, price: 1000, subtotal: 2000, image: "https://joro.pk/product.png" }] };
  const emails = [orderConfirmationEmail(order), vendorOrderEmail(order, shop)];
  const executablePath = process.env.JORO_TEST_BROWSER || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [320, 375, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route("**/*", route => route.abort());
      for (let index = 0; index < emails.length; index++) {
        const email = emails[index];
        await page.setContent(email.html);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px email overflow`);
        assert.equal(await page.locator('img[alt="JORO"]').getAttribute("src"), "https://joro.pk/logo.png");
        assert.ok(await page.getByRole("heading", { name: email.subject }).isVisible());
        const action = page.getByRole("link", { name: index === 0 ? "Track Your Order" : "View Order", exact: true });
        assert.equal(await action.getAttribute("href"), index === 0 ? "https://joro.pk/account/orders/order-test" : "https://joro.pk/vendor/dashboard/orders/shop-test");
        assert.ok(await action.isVisible());
        assert.match(await page.locator("body").innerText(), /pending \(due on delivery\)/);
        await action.focus(); assert.equal(await action.evaluate(el => el === document.activeElement), true);
      }
      console.log(`PASS ${width}px: customer/vendor email layout, long names, logo URL, accurate COD status, accessible action and correct order URLs`);
      await page.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
