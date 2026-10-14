import { chromium } from "playwright-core";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.MARKETPLACE_TEST_BASE || "http://localhost:3115";
const browser = await chromium.launch({ executablePath: process.env.ACCOUNT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const directory = await mkdtemp(join(tmpdir(), "joro-marketplace-"));
let failures = 0;
try {
  for (const width of [390, 768, 1440]) {
    for (const [name, route, heading] of [["home", "/", "Shop by Category"], ["services", "/services", "Find a trusted service provider"], ["gifts", "/gifts", "Thoughtful gifts for every occasion"], ["wants", "/wants", "Wants"]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const response = await page.goto(base + route, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const hasHeading = await page.getByRole("heading", { name: heading, exact: true }).count() > 0;
      const errorScreen = await page.getByText("This page could not be loaded").count() > 0;
      const path = join(directory, `${name}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      const okay = response?.status() === 200 && overflow <= 1 && errors.length === 0 && hasHeading && !errorScreen;
      if (!okay) failures++;
      console.log(`${okay ? "PASS" : "FAIL"} ${name} ${width}px status=${response?.status()} overflow=${overflow} errors=${errors.length} heading=${hasHeading} ${path}`);
      await page.close();
    }
  }
} finally { await browser.close(); }
if (failures) process.exitCode = 1;
