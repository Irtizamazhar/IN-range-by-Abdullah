/* Real form and controls, mocked onboarding HTTP API. No database or mail sent. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import { chromium } from 'playwright-core';

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const build = await esbuild.build({
    stdin: { contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import {VendorOnboardingForm} from "./components/vendor/VendorOnboardingForm"; createRoot(document.getElementById("root")).render(<VendorOnboardingForm/>);', resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, outfile: 'form.js', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'next-navigation-fixture', setup(builder) {
      builder.onResolve({ filter: /^@\/hooks\/useLoadingRouter$/ }, () => ({ path: 'router', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/components\/ui\/LoadingLink$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/components\/user\/LogoMark$/ }, () => ({ path: 'logo', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ loader: 'tsx', resolveDir: root, contents: name === 'router' ? 'export const useLoadingRouter=()=>({push:async url=>{window.__destination=url;}});' : name === 'logo' ? 'import React from "react"; export const LogoMark=()=> <a href="/">JORO</a>;' : 'import React from "react"; export default function Link(props){return <a {...props}/>;}' }));
    } }],
  });
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  const styles = await postcss([tailwind({ ...config, content: [path.join(root, 'components/vendor/VendorOnboardingForm.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
  const js = build.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = styles.css + '\n' + (build.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
  const server = http.createServer((req, res) => {
    if (req.url === '/form.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(js); }
    else if (req.url === '/form.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/form.css"></head><body><div id="root"></div><script src="/form.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file => fs.existsSync(file));
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    for (const width of [360, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const clientErrors = [];
      page.on('pageerror', error => clientErrors.push(error.message));
      let saved = { ownerName: 'Test Seller', email: 'seller@example.invalid', phone: '', city: '', address: '', shopName: '', businessType: 'individual', primaryCategory: 'Other', documents: [], onboardingData: {} };
      let writes = 0;
      let fail = false;
      let malformed = false;
      let release;
      let hold = false;
      await page.route('**/api/vendor/onboarding', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { vendor: saved } });
        writes++;
        const form = await new Request(route.request().url(), { method: route.request().method(), headers: route.request().headers(), body: route.request().postDataBuffer() }).formData();
        if (hold) await new Promise(resolve => { release = resolve; });
        if (fail) return route.fulfill({ status: 503, json: { error: 'Setup could not be saved. Please retry.' } });
        if (malformed) return route.fulfill({ json: {} });
        const values = Object.fromEntries(form);
        saved = { ...saved, ...values, ownerName: values.name, primaryCategory: values.category, onboardingData: { ...values, step: Number(values.step), returnSameAsPickup: values.returnSameAsPickup === 'true' } };
        return route.fulfill({ json: { ok: true, documents: [] } });
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      await page.goto(base);
      await page.getByLabel('Store Name', { exact: true }).waitFor();
      const primary = page.getByRole('button', { name: 'Save & Continue', exact: true });
      const secondary = page.getByRole('button', { name: 'Save Progress', exact: true });
      await primary.click();
      assert.equal(writes, 0, 'invalid active step must not be sent');
      await page.getByRole('alert').first().waitFor();
      for (const [label, value] of Object.entries({ 'Store Name': 'Pakistani Store', 'Store / Business Description': 'Carefully selected products for your home.', 'Contact Number': '03001234567', 'Business Address': '123 Test Street', 'City': 'Lahore', 'Province / Region': 'Punjab', 'Postal Code (optional)': '54000' })) await page.getByLabel(label, { exact: true }).fill(value);
      // Save Progress persists without navigating.
      await secondary.click();
      await page.getByText('Progress saved.', { exact: false }).waitFor();
      assert.equal(saved.onboardingData.step, 0);
      await page.getByLabel('Store Name', { exact: true }).waitFor();
      // Failed and malformed saves retain all values and the current step.
      for (const mode of ['failure', 'malformed']) {
        fail = mode === 'failure'; malformed = mode === 'malformed';
        await primary.click();
        await page.getByRole('alert').first().waitFor();
        assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Lahore');
        assert.equal(await page.getByLabel('Postal Code (optional)', { exact: true }).inputValue(), '54000');
        assert.equal(saved.onboardingData.step, 0);
      }
      fail = false; malformed = false; hold = true;
      const before = writes;
      await primary.click();
      await page.waitForFunction(() => document.querySelector('form')?.getAttribute('aria-busy') === 'true');
      assert.equal(await secondary.isDisabled(), true);
      await page.locator('form').dispatchEvent('submit');
      await page.waitForTimeout(75);
      assert.equal(writes, before + 1, 'pending form must prevent duplicate submissions');
      release(); hold = false;
      await page.getByLabel('Legal Full Name', { exact: true }).waitFor();
      assert.equal(saved.onboardingData.step, 1);
      await page.reload();
      await page.getByLabel('Legal Full Name', { exact: true }).waitFor();
      await page.getByRole('button', { name: /1\. Store & Business/ }).click();
      await page.getByLabel('City', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Lahore');
      assert.equal(await page.getByLabel('Primary Product Category', { exact: true }).inputValue(), 'Other');
      // Business fields are available and validation preserves entered identity values.
      await page.getByLabel('Seller Type').selectOption('company');
      await primary.click();
      await page.getByLabel('Registered Business Name', { exact: true }).waitFor();
      await page.getByLabel('CNIC Number', { exact: true }).fill('1234512345671');
      await primary.click();
      await page.getByRole('alert').first().waitFor();
      assert.equal(await page.getByLabel('CNIC Number', { exact: true }).inputValue(), '12345-1234567-1');
      await page.getByLabel('Registered Business Name', { exact: true }).fill('Example Limited');
      await page.getByLabel('Business Registration Number', { exact: true }).fill('REG-123');
      for (const label of ['CNIC front', 'CNIC back', 'Business registration document']) await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRsAAAAASUVORK5CYII=', 'base64') });
      await primary.click();
      await page.getByLabel('Pickup Address', { exact: true }).waitFor();
      // Form actions are ordered left/right and fit the viewport at both sizes.
      const left = await secondary.boundingBox();
      const right = await primary.boundingBox();
      assert.ok(left.x + left.width <= right.x + 1);
      assert.ok(left.width >= 44 && right.width >= 44 && left.height >= 44 && right.height >= 44);
      assert.ok(right.x + right.width <= width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepEqual(clientErrors, []);
      console.log(`PASS ${width}px: validation, Save Progress, failed/invalid responses, duplicate prevention, advance, refresh persistence, Business fields, action layout, no horizontal overflow`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
