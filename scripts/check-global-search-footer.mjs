import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("http://localhost:3101", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Can't find it? Post your want." }).waitFor();
    const home = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      footerWhite: getComputedStyle(document.querySelector("footer")).backgroundColor,
      oldTagline: document.querySelector("footer")?.textContent?.includes("Apni Market"),
      oldPayments: document.querySelector("footer")?.textContent?.includes("Visa"),
      skyline: !!document.querySelector('footer img[src*="pakistan-skyline"]'),
    }));
    if (home.overflow || home.oldTagline || home.oldPayments || !home.skyline) throw new Error(`Home/footer check failed at ${width}: ${JSON.stringify(home)}`);
    if (width <= 390) {
      const accordion = page.locator("footer details").first();
      await accordion.locator("summary").click();
      if (!(await accordion.evaluate((node) => node.open))) throw new Error("Footer accordion did not open");
      await accordion.locator("summary").press("Enter");
      if (await accordion.evaluate((node) => node.open)) throw new Error("Footer accordion did not close from keyboard");
    }
    if (width === 1440) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForFunction(() => { const img = document.querySelector('footer img[src*="pakistan-skyline"]'); return img?.complete && img.naturalWidth > 0; }); }
    console.log("layout", width, JSON.stringify(home));
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await page.goto("http://localhost:3101", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const search = page.getByRole("combobox", { name: "Search JORO marketplace" });
  await search.fill("unlikely-query-xyz-999");
  await page.getByRole("listbox", { name: "Search suggestions" }).waitFor();
  await page.getByText("No matching public listings yet.").waitFor();
  await search.press("Enter");
  await page.waitForURL(/\/search\?q=unlikely-query-xyz-999/);
  await page.getByText("No public results match this search.", { exact: false }).waitFor();
  await page.goto("http://localhost:3101/services", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Search JORO marketplace" }).fill("AC repair");
  await page.getByRole("button", { name: "Search marketplace" }).click();
  await page.waitForURL(/\/search\?q=AC%20repair/);
  console.log("search navigation and empty state passed");
  await page.close();
  const keyboardPage = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await keyboardPage.route("**/api/search/suggestions?q=*", (route) => route.fulfill({ json: { items: [{ id: "test", kind: "services", title: "Sofa repair", detail: "Repair", href: "/services" }] } }));
  await keyboardPage.goto("http://localhost:3101", { waitUntil: "domcontentloaded" });
  await keyboardPage.waitForTimeout(400);
  const keyboardInput = keyboardPage.getByRole("combobox", { name: "Search JORO marketplace" });
  await keyboardInput.fill("sofa");
  await keyboardPage.getByRole("option", { name: /Sofa repair/ }).waitFor();
  await keyboardInput.press("ArrowDown");
  await keyboardInput.press("Enter");
  await keyboardPage.waitForURL("http://localhost:3101/services");
  console.log("suggestion keyboard navigation passed");
  await keyboardPage.close();
  const voicePage = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await voicePage.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { window.setTimeout(() => this.onresult?.({ resultIndex: 0, results: [[{ transcript: "AC repair" }]] }), 80); }
      stop() { this.onend?.(); }
    };
  });
  await voicePage.goto("http://localhost:3101", { waitUntil: "domcontentloaded" });
  await voicePage.waitForTimeout(400);
  await voicePage.getByRole("button", { name: "Start voice search" }).click();
  await voicePage.waitForURL(/\/search\?q=AC%20repair/);
  console.log("mock speech recognition navigation passed");
  await voicePage.close();
  const stopPage = await browser.newPage();
  await stopPage.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { window.__voiceLang = this.lang; this.timer = window.setTimeout(() => this.onresult?.({ resultIndex: 0, results: [[{ transcript: "should not search" }]] }), 650); }
      stop() { window.clearTimeout(this.timer); this.onend?.(); }
    };
  });
  await stopPage.goto("http://localhost:3101", { waitUntil: "domcontentloaded" });
  await stopPage.waitForTimeout(400);
  await stopPage.getByRole("combobox", { name: "Voice search language" }).selectOption("ur-PK");
  await stopPage.getByRole("button", { name: "Start voice search" }).click();
  if (await stopPage.evaluate(() => window.__voiceLang) !== "ur-PK") throw new Error("Urdu recognition language was not applied");
  await stopPage.getByRole("button", { name: "Stop voice search" }).click();
  await stopPage.waitForTimeout(750);
  if (new URL(stopPage.url()).pathname !== "/") throw new Error("Cancelled voice search navigated");
  console.log("voice language and cancellation passed");
  await stopPage.close();
  const deniedPage = await browser.newPage();
  await deniedPage.addInitScript(() => { window.SpeechRecognition = class { start() { window.setTimeout(() => this.onerror?.({ error: "not-allowed" }), 30); } stop() { this.onend?.(); } }; });
  await deniedPage.goto("http://localhost:3101", { waitUntil: "domcontentloaded" });
  await deniedPage.waitForTimeout(400);
  await deniedPage.getByRole("button", { name: "Start voice search" }).click();
  await deniedPage.getByRole("status").getByText("Microphone permission denied").waitFor();
  console.log("voice permission error passed");
  await deniedPage.close();
  const unsupportedPage = await browser.newPage();
  await unsupportedPage.addInitScript(() => { Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true }); Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true }); });
  await unsupportedPage.goto("http://localhost:3101", { waitUntil: "domcontentloaded" });
  await unsupportedPage.waitForTimeout(400);
  if (await unsupportedPage.getByRole("button", { name: "Start voice search" }).count()) throw new Error("Unsupported browser still shows voice control");
  console.log("unsupported voice browser fallback passed");
  await unsupportedPage.close();
} finally { await browser.close(); }
