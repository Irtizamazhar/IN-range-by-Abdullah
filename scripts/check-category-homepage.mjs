import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("http://localhost:3100", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Shop by Category" }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Explore JORO collections"] img')].every((img) => img.complete), { timeout: 10000 });
    const report = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      sections: [...document.querySelectorAll("main section")].slice(0, 3).map((node) => node.getAttribute("aria-label") || node.querySelector("h2")?.textContent?.trim()),
      bannerLinks: [...document.querySelectorAll('section[aria-label="Explore JORO collections"] a')].map((node) => node.getAttribute("href")),
      imagesLoaded: [...document.querySelectorAll('section[aria-label="Explore JORO collections"] img')].every((img) => img.complete && img.naturalWidth > 0),
    }));
    console.log(width, JSON.stringify(report));
    if (report.overflow || !report.imagesLoaded || report.bannerLinks.length !== 3) throw new Error(`Homepage check failed at ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}
