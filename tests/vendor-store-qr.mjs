import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import QRCode from "qrcode";
import jsQR from "jsqr";
import sharp from "sharp";
import { chromium } from "playwright-core";
import { vendorStoreQrUrl } from "../lib/vendor-store-qr-url.ts";

const ids = ["cmvendorone1234567890123", "cmvendortwo1234567890123"];
const urls = ids.map(vendorStoreQrUrl);
assert.notEqual(urls[0], urls[1]);
assert.equal(vendorStoreQrUrl(ids[0]), urls[0]);
assert.throws(() => vendorStoreQrUrl(""));

const bundle = await build({
  stdin: {
    contents: `import React from "react";
import { createRoot } from "react-dom/client";
import { StoreQr, renderStoreQrCard } from "./components/vendor/StoreQr";
export { renderStoreQrCard };
export function mount(url, name) { createRoot(document.getElementById("root")).render(React.createElement(StoreQr, { url, name })); }`,
    resolveDir: process.cwd(), sourcefile: "qr-test-entry.tsx", loader: "tsx",
  },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  globalName: "QrCardTest",
  plugins: [{ name: "css-module-stub", setup(bundler) {
    bundler.onResolve({ filter: /\.module\.css$/ }, args => ({ path: resolve(args.resolveDir, args.path), namespace: "css-stub" }));
    bundler.onLoad({ filter: /.*/, namespace: "css-stub" }, async args => {
      const css = await readFile(args.path, "utf8");
      const names = [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => match[1]);
      return { contents: `export default ${JSON.stringify(Object.fromEntries(names.map(name => [name, name])))}`, loader: "js" };
    });
  } }],
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : process.platform === "win32" ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const logo = await readFile("public/logo.png");
  await page.route("https://joro.pk/qr-test/**", route => {
    if (route.request().url().endsWith("/logo.png"))
      return route.fulfill({ body: logo, contentType: "image/png" });
    return route.fulfill({ body: "<html><body><div id='root'></div></body></html>", contentType: "text/html" });
  });
  await page.route("https://joro.pk/logo.png", route => route.fulfill({ body: logo, contentType: "image/png" }));
  await page.goto("https://joro.pk/qr-test/");
  await page.addStyleTag({ content: await readFile("components/vendor/StoreQr.module.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  for (const [index, url] of urls.entries()) {
    const name = "Same Store Name";
    const qr = await QRCode.toDataURL(url, { width: 680, margin: 4, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
    const png = await page.evaluate(async ({ url, name, qr }) => {
      const card = await window.QrCardTest.renderStoreQrCard(url, name, qr);
      return card.toDataURL("image/png").split(",")[1];
    }, { url, name, qr });
    const buffer = Buffer.from(png, "base64");
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1200); assert.equal(info.height, 1800);
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    assert.equal(decoded?.data, url, `card ${index + 1} must decode to its own vendor URL`);
  }
  const longName = "A Very Long Electronics And Home Appliances Store Name For Card Layout Verification";
  const longUrl = `https://joro.pk/stores/${"a".repeat(75)}`;
  const qr = await QRCode.toDataURL(longUrl, { width: 680, margin: 4, errorCorrectionLevel: "H" });
  const png = await page.evaluate(async ({ longUrl, longName, qr }) => {
    const card = await window.QrCardTest.renderStoreQrCard(longUrl, longName, qr);
    return card.toDataURL("image/png").split(",")[1];
  }, { longUrl, longName, qr });
  const { data, info } = await sharp(Buffer.from(png, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, longUrl);
  await page.evaluate(url => window.QrCardTest.mount(url, "Same Store Name"), urls[0]);
  const downloadButton = page.getByRole("button", { name: "Download QR Card PNG" });
  await downloadButton.waitFor();
  await page.waitForFunction(() => !document.querySelector("button")?.disabled);
  const mobileLayout = await page.evaluate(() => {
    const card = document.querySelector(".card").getBoundingClientRect();
    const qr = document.querySelector(".qrBorder").getBoundingClientRect();
    return { width: document.documentElement.scrollWidth, cardWidth: card.width, centered: Math.abs((qr.left + qr.right) / 2 - (card.left + card.right) / 2) < 2 };
  });
  assert.ok(mobileLayout.width <= 390 && mobileLayout.cardWidth <= 390 && mobileLayout.centered, "mobile card must fit and center its QR");
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.ok(await page.locator(".card").evaluate(card => card.getBoundingClientRect().width <= 520));
  const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
  assert.match(download.suggestedFilename(), /^joro-store-.*-qr-card\.png$/);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const saved = await sharp(Buffer.concat(chunks)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(saved.data), saved.info.width, saved.info.height)?.data, urls[0]);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: value => { window.copiedStoreUrl = value; return Promise.resolve(); } }, configurable: true });
  });
  await page.getByRole("button", { name: "Share Store Link" }).click();
  assert.equal(await page.evaluate(() => window.copiedStoreUrl), urls[0]);
  await page.getByRole("button", { name: "Copy Store Link" }).click();
  assert.equal(await page.evaluate(() => window.copiedStoreUrl), urls[0]);
  assert.equal(await page.getByRole("link", { name: "Visit Store" }).getAttribute("href"), urls[0]);
  console.log("QR cards: two duplicate-name vendors and long-name/URL PNGs decoded exactly; 1200x1800 export verified.");
  console.log("Dashboard download saved a decodable PNG; copy/share fallback and visit link matched; mobile/desktop card fit checks passed.");
} finally {
  await browser.close();
}
