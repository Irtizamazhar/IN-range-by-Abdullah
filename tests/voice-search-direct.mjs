import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = "http://localhost:3457";
const browsers = [
  ["Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
  ["Edge", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
];

async function run(executablePath, browserName, width) {
  console.log(`Starting ${browserName} ${width}px`);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    page.setDefaultTimeout(12000);
    await page.addInitScript(() => {
      window.SpeechRecognition = class {
        start() {
          window.__voiceLanguage = this.lang;
          window.setTimeout(() => {
            if (window.__voiceError) this.onerror?.({ error: window.__voiceError });
            else this.onresult?.({ resultIndex: 0, results: [[{ transcript: window.__voiceText || "blue shoes" }]] });
            this.onend?.();
          }, 30);
        }
        stop() { this.onend?.(); }
      };
    });
    const searches = [];
    await page.route("**/api/products?search=*", async route => {
      const search = new URL(route.request().url()).searchParams.get("search");
      searches.push(search);
      await route.fulfill({ json: { products: search === "shoes" ? [{ _id: "product-1", name: "Blue Running Shoes", price: 3200, images: ["/logo.png"] }] : [] } });
    });
    await page.route("**/api/search/suggestions?q=*", route => route.fulfill({ json: { items: [{ id: "typed", kind: "products", title: "Typed result", href: "/products/typed" }] } }));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    console.log("Page loaded");
    const input = page.getByRole("combobox", { name: "Search JORO marketplace" });
    await page.getByRole("button", { name: "Start voice search" }).click();
    console.log("Voice clicked");
    const results = page.getByRole("region", { name: "Voice search products" });
    await results.getByText("Blue Running Shoes").waitFor();
    assert.deepEqual(searches, ["blue shoes", "shoes"]);
    assert.match(await results.innerText(), /3,200/);
    assert.equal(await results.locator("img").count(), 1);
    assert.equal(await results.getByRole("link").getAttribute("href"), "/products/product-1");
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.getByRole("listbox", { name: "Search suggestions" }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    await page.evaluate(() => { window.__voiceText = "unmatched item"; });
    await page.getByRole("button", { name: "Start voice search" }).click();
    try { await results.getByText("No products found", { exact: true }).waitFor(); }
    catch (error) { console.log("Empty-state diagnostic", searches, await page.locator("body").innerText()); throw error; }

    await input.fill("typed");
    try { await page.getByRole("option", { name: /Typed result/ }).waitFor(); }
    catch (error) { console.log("Typed diagnostic", await input.inputValue(), await page.getByRole("listbox", { name: "Search suggestions" }).count(), (await page.locator("body").innerText()).slice(0, 1200)); throw error; }
    assert.equal(await results.count(), 0);

    await page.getByRole("combobox", { name: "Voice search language" }).selectOption("ur-PK");
    await page.evaluate(() => { window.__voiceText = "جوتے"; });
    await page.getByRole("button", { name: "Start voice search" }).click();
    await results.getByText("No products found", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__voiceLanguage), "ur-PK");

    await page.evaluate(() => { window.__voiceError = "not-allowed"; });
    await page.getByRole("button", { name: "Start voice search" }).click();
    await page.getByRole("status").getByText(/Microphone permission denied/).waitFor();
    assert.equal(await results.count(), 0);
    await page.close();
    console.log(`${browserName} ${width}px: voice, partial, empty, typed, Urdu, denied, layout passed`);

    const unsupported = await browser.newPage({ viewport: { width, height: 800 } });
    await unsupported.addInitScript(() => {
      Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
      Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
    });
    await unsupported.goto(base, { waitUntil: "domcontentloaded" });
    await unsupported.getByRole("button", { name: "Voice search unavailable in this browser" }).click();
    await unsupported.getByRole("status").getByText("Voice search is not supported in this browser.").waitFor();
    await unsupported.close();
  } finally {
    await browser.close();
  }
}

for (const [name, executablePath] of browsers.filter(([name]) => !process.env.ONLY_BROWSER || name === process.env.ONLY_BROWSER)) {
  for (const width of [390, 1280]) await run(executablePath, name, width);
}
