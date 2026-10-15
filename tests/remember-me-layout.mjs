import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : process.platform === "win32" ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {}),
});
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    for (const role of ["customer", "vendor"]) {
      await page.goto(`http://localhost:3456/login?role=${role}&mode=signin`, { waitUntil: "domcontentloaded" });
      const checkbox = page.getByRole("checkbox", { name: /remember me/i });
      await checkbox.waitFor({ timeout: 30000 });
      assert.equal(await checkbox.isChecked(), false);
      const bounds = await checkbox.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
      await checkbox.check();
      assert.equal(await checkbox.isChecked(), true);
    }
    await page.close();
  }
  console.log("Customer and vendor Remember Me controls passed 390px and 1280px browser checks.");
} finally {
  await browser.close();
}
