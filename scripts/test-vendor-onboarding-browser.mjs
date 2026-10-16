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
  const styles = await postcss([tailwind({ ...config, content: [path.join(root, 'components/vendor/VendorOnboardingForm.tsx'), path.join(root, 'components/ui/Pakistan*.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
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
      let saved = { ownerName: 'Test Seller', email: 'seller@example.invalid', phone: '', city: '', address: '', shopName: '', bankName: null, businessType: 'individual', primaryCategory: 'Other', documents: [], onboardingData: {} };
      let writes = 0;
      let fail = false;
      let malformed = false;
      let expired = false;
      let proxyError = false;
      let release;
      let hold = false;
      await page.route('**/api/vendor/onboarding', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { vendor: saved } });
        writes++;
        const form = await new Request(route.request().url(), { method: route.request().method(), headers: route.request().headers(), body: route.request().postDataBuffer() }).formData();
        if (hold) await new Promise(resolve => { release = resolve; });
        if (fail) return route.fulfill({ status: 503, json: { error: 'Setup could not be saved. Please retry.' } });
        if (expired) return route.fulfill({ status: 401, json: { error: 'Seller sign-in required.' } });
        if (proxyError) return route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Bad Gateway</h1>' });
        if (malformed) return route.fulfill({ json: {} });
        const values = Object.fromEntries(form);
        assert.equal('bankName' in values && values.bankName === 'null', false, 'nullable saved fields must never be persisted as literal null text');
        saved = { ...saved, ...values, ownerName: values.name, primaryCategory: values.category, onboardingData: { ...values, step: Number(values.step), returnSameAsPickup: values.returnSameAsPickup === 'true' } };
        return route.fulfill({ json: { ok: true, documents: [] } });
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      await page.goto(base);
      await page.getByLabel('Store Name', { exact: true }).waitFor();
      const primary = page.getByRole('button', { name: 'Save & Continue', exact: true });
      const secondary = page.getByRole('button', { name: 'Save Progress', exact: true });
      async function typeFocused(label, value) {
        const input = page.getByLabel(label, { exact: true });
        await input.fill(''); await input.click();
        const element = await input.elementHandle();
        await input.pressSequentially(value, { delay: 4 });
        assert.equal(await element.evaluate(node => node.isConnected && document.activeElement === node), true, `${label}: typing must preserve the same focused DOM node`);
      }
      // Reproduces the original effect bug before validation has ever run.
      await typeFocused('Store Name', 'Draft Store');
      await typeFocused('Store Slug', 'draft-store');
      await page.getByLabel('Store Slug', { exact: true }).evaluate(node => node.setSelectionRange(2, 2));
      await page.keyboard.type('x');
      assert.equal(await page.getByLabel('Store Slug', { exact: true }).evaluate(node => node.selectionStart), 3);
      await page.keyboard.press('Tab');
      assert.equal(await page.getByLabel('Primary Product Category', { exact: true }).evaluate(node => document.activeElement === node), true);
      await page.getByLabel('Store Name', { exact: true }).fill('');
      await page.getByLabel('Store Slug', { exact: true }).fill('');
      await primary.click();
      assert.equal(writes, 0, 'invalid active step must not be sent');
      await page.getByRole('alert').first().waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'shopName');
      for (const [label, value] of Object.entries({ 'Store Name': 'Pakistani Store', 'Store / Business Description': 'Carefully selected products for your home.', 'Contact Number': '3001234567', 'Business Address': '123 Test Street', 'City': 'Lahore', 'Province / Region': 'Punjab', 'Postal Code (optional)': '54000' })) await typeFocused(label, value);
      // Save Progress persists without navigating.
      await secondary.click();
      await page.getByText('Progress saved.', { exact: false }).waitFor();
      assert.equal(saved.onboardingData.step, 0);
      await page.getByLabel('Store Name', { exact: true }).waitFor();
      // Failed and malformed saves retain all values and the current step.
      for (const mode of ['failure', 'malformed', 'expired', 'proxy']) {
        fail = mode === 'failure'; malformed = mode === 'malformed';
        expired = mode === 'expired'; proxyError = mode === 'proxy';
        await primary.click();
        await page.getByText(mode === 'failure' ? 'Setup could not be saved. Please retry.' : mode === 'malformed' ? 'The server did not confirm your save. Please try again.' : mode === 'expired' ? /session has expired/i : /server could not save your details/i).waitFor();
        if (expired) assert.match(await page.getByRole('alert').first().innerText(), /session has expired/i);
        if (proxyError) assert.match(await page.getByRole('alert').first().innerText(), /could not save your details/i);
        assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Lahore');
        assert.equal(await page.getByLabel('Postal Code (optional)', { exact: true }).inputValue(), '54000');
        assert.equal(saved.onboardingData.step, 0);
      }
      fail = false; malformed = false; expired = false; proxyError = false; hold = true;
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
      await typeFocused('Legal Full Name', 'Test Seller');
      await typeFocused('CNIC Number', '1234512345671');
      await primary.click();
      await page.getByRole('alert').first().waitFor();
      assert.equal(await page.getByLabel('CNIC Number', { exact: true }).inputValue(), '12345-1234567-1');
      await typeFocused('Registered Business Name', 'Example Limited');
      await typeFocused('Business Registration Number', 'REG-123');
      for (const label of ['CNIC front', 'CNIC back', 'Business registration document']) await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRsAAAAASUVORK5CYII=', 'base64') });
      await primary.click();
      await page.getByLabel('Pickup Address', { exact: true }).waitFor();
      for (const [label, value] of Object.entries({ 'Pickup Address': '123 Test Street', 'Pickup City': 'Lahore', 'Pickup Province': 'Punjab', 'Pickup Contact Person': 'Test Seller', 'Pickup Contact Phone': '3117654321' })) await typeFocused(label, value);
      await page.getByRole('checkbox', { name: 'Return address same as pickup' }).uncheck();
      for (const [label, value] of Object.entries({ 'Return Address': '456 Return Street', 'Return City': 'Karachi', 'Return Province': 'Sindh', 'Return Contact Person': 'Returns Contact', 'Return Contact Phone': '3009876543' })) await typeFocused(label, value);
      await primary.click();
      await page.getByLabel('Account Title', { exact: true }).waitFor();
      for (const [label, value] of Object.entries({ 'Account Title': 'Test Seller', 'Bank Name': 'Test Bank', 'Account Number': '123456789' })) await typeFocused(label, value);
      await secondary.click();
      await page.getByText('Progress saved.', { exact: false }).waitFor();
      assert.equal(saved.onboardingData.step, 3);
      await primary.click();
      await page.getByRole('button', { name: 'Submit for Approval' }).waitFor();
      await page.getByRole('button', { name: 'Edit Bank / Payout' }).click();
      await page.getByLabel('Account Title', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Account Number', { exact: true }).inputValue(), '123456789');
      await typeFocused('Account Title', 'Updated Seller');
      // Form actions are ordered left/right and fit the viewport at both sizes.
      const left = await secondary.boundingBox();
      const right = await primary.boundingBox();
      assert.ok(left.x + left.width <= right.x + 1);
      assert.ok(left.width >= 44 && right.width >= 44 && left.height >= 44 && right.height >= 44);
      assert.ok(right.x + right.width <= width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepEqual(clientErrors, []);
      console.log(`PASS ${width}px: continuous focus/caret/Tab retention before and after validation across all editable steps, Review editing, fixed mobile fields, validation, Save Progress/Continue, error preservation, refresh persistence, action layout, no horizontal overflow`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
