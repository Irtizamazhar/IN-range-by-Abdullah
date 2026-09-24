// Isolated browser regression of the actual component; no database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');

async function main() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'joro-qr-'));
  const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {StoreQr} from './components/vendor/StoreQr'; const root=createRoot(document.getElementById('root')); window.renderQr=(url)=>root.render(<StoreQr url={url} name={'Shop <b> & Friends'}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
  const browser = await chromium.launch({ executablePath: process.env.ACCOUNT_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    await context.addInitScript(() => { window.print = () => { window.printCalled = true; }; });
    const page = await context.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => window.renderQr(null));
    await page.getByText('QR code is waiting for a public HTTPS domain.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Generate QR Code' }).count(), 0);
    const url = 'https://store.example.org/stores/validation-shop';
    await page.evaluate(url => window.renderQr(url), url);
    await page.getByRole('button', { name: 'Generate QR Code' }).click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Download PNG').disabled);
    assert.equal(await page.getByRole('link', { name: 'Visit Store' }).getAttribute('href'), url);
    for (const format of ['PNG', 'SVG']) {
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download ' + format }).click();
      const download = await downloading;
      await download.saveAs(path.join(output, 'qr.' + format.toLowerCase()));
    }
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Print QR' }).click();
    const popup = await popupPromise;
    await popup.waitForFunction(() => window.printCalled === true);
    assert.equal(await popup.locator('p').textContent(), 'Scan to visit Shop <b> & Friends');
    assert.equal(await popup.locator('b').count(), 0);
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.close();
    // Rasterize the downloaded SVG with the browser for independent decoding.
    const svg = fs.readFileSync(path.join(output, 'qr.svg'), 'utf8');
    const raster = await page.evaluate(async svg => {
      const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(svg); await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1200;
      canvas.getContext('2d').drawImage(img, 0, 0, 1200, 1200); return canvas.toDataURL().split(',')[1];
    }, svg);
    fs.writeFileSync(path.join(output, 'qr-svg.png'), Buffer.from(raster, 'base64'));
    await page.evaluate(() => window.renderQr('https://store.example.org/stores/renamed-shop'));
    await page.getByRole('button', { name: 'Generate QR Code' }).waitFor();
    assert.equal(await page.locator('canvas').count(), 0);
    console.log('PASS: missing URL gate, generation, destination, PNG/SVG exports, print, safe shop-name rendering, URL-change reset');
    console.log('QR_ARTIFACTS=' + output);
    console.log('EXPECTED_URL=' + url);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
