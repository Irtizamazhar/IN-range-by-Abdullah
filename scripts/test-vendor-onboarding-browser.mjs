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
  const styles = await postcss([tailwind({ ...config, content: [path.join(root, 'components/vendor/VendorOnboardingForm.tsx'), path.join(root, 'components/ui/Pakistan*.tsx'), path.join(root, 'components/ui/ImageLightbox.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
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
      const imageRequests = [];
      await page.route('**/api/private/vendor-documents/*', route => { imageRequests.push(route.request().url()); return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64') }); });
      await page.route('**/api/categories', route => route.fulfill({ json: [{ id: 1, name: 'Mobiles & Accessories' }, { id: 2, name: 'Other' }] }));
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
        const text = Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === 'string'));
        const names = { ...(saved.onboardingData.documentNames || {}) };
        for (const type of ['cnic_front', 'cnic_back', 'license']) if (form.get(type) && typeof form.get(type) !== 'string') { saved.documents = [...saved.documents, { id: type + saved.documents.length, documentType: type }]; names[type] = form.get(type).name; }
        saved = { ...saved, ...text, ...('name' in text ? { ownerName: text.name } : {}), ...('category' in text ? { primaryCategory: text.category } : {}), onboardingData: { ...saved.onboardingData, ...text, documentNames: names, step: Number(text.step), ...('returnSameAsPickup' in text ? { returnSameAsPickup: text.returnSameAsPickup === 'true' } : {}) } };
        if (route.request().method() === 'POST') return route.fulfill({ json: { ok: true, status: 'pending' } });
        return route.fulfill({ json: { ok: true, documents: saved.documents } });
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      await page.goto(base);

      const png = { name: 'cnic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64') };
      const shots = path.join(root, 'node_modules/.cache/onboarding-shots');
      fs.mkdirSync(shots, { recursive: true });
      const shot = name => page.screenshot({ path: path.join(shots, `${width}-${name}.png`), fullPage: true });
      const cont = page.getByRole('button', { name: /^(Continue|Save & Review)/ });
      const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal overflow');

      // Step 1: blank record shows phone; Continue validates and focuses the first error.
      await page.getByLabel(/^Store name/).waitFor();
      await cont.click();
      await page.getByText('Please fix the highlighted fields.').waitFor();
      assert.equal(await page.getByLabel(/^Store name/).evaluate(node => document.activeElement === node), true);
      assert.equal(writes, 0);
      await page.getByLabel(/^Store name/).fill('Khan Mobile');
      await page.getByLabel(/^What do you sell/).selectOption('Mobiles & Accessories');
      await page.getByLabel(/^Shop address/).fill('Shop 12, Main Market');
      await page.getByRole('combobox', { name: 'City' }).fill('Lahore');
      await page.getByRole('combobox', { name: 'City' }).press('Escape');
      assert.equal(await page.getByLabel(/^Province/).inputValue(), 'Punjab', 'city selects province');
      await page.getByLabel(/^Contact number/).fill('3001234567');
      assert.equal(await page.getByText('Store Slug').count(), 0, 'slug is never asked');
      await noOverflow(); await shot('1-business');
      // Save failure keeps entries.
      fail = true; await cont.click();
      await page.getByText('Setup could not be saved. Please retry.').waitFor();
      assert.equal(await page.getByLabel(/^Store name/).inputValue(), 'Khan Mobile');
      fail = false; expired = true; await cont.click();
      await page.getByText(/session has expired/).waitFor();
      expired = false; await cont.click();

      // Step 2: individual needs two CNIC sides only.
      await page.getByLabel(/^CNIC number/).waitFor();
      assert.equal(saved.onboardingData.step, 1);
      assert.equal(saved.storeSlug, undefined, 'client never sends a slug');
      assert.equal(await page.getByLabel(/^Full name/).inputValue(), 'Test Seller', 'name prefilled');
      assert.equal(await page.getByText('Registration document', { exact: true }).count(), 0);
      await page.getByLabel(/^CNIC number/).fill('3520212345671');
      await cont.click();
      await page.getByText('Upload this side to continue.').first().waitFor();
      await page.locator('input[name=cnic_front]').setInputFiles({ ...png, mimeType: 'application/pdf', name: 'x.pdf' });
      await page.getByText('Use a JPG, PNG or WebP image under 5MB.').waitFor();
      // No cards before a successful upload; a failed upload shows an error and still no card.
      assert.equal(await page.getByRole('heading', { name: 'Uploaded CNIC cards' }).count(), 0);
      fail = true;
      await page.locator('input[name=cnic_front]').setInputFiles(png);
      await page.locator('#cnic_front-error').getByText('Setup could not be saved. Please retry.').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Uploaded CNIC cards' }).count(), 0);
      fail = false;
      // Uploading shows a loader, then only the uploaded side gets a card.
      hold = true;
      await page.locator('input[name=cnic_front]').setInputFiles({ ...png, name: 'cnic-front.png' });
      await page.getByText('Uploading…').first().waitFor();
      hold = false; release();
      await page.getByRole('heading', { name: 'CNIC Front Side' }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'CNIC Back Side' }).count(), 0);
      await page.getByText('cnic-front.png').waitFor();
      await page.locator('input[name=cnic_back]').setInputFiles({ ...png, name: 'cnic-back.png' });
      await page.getByRole('heading', { name: 'CNIC Back Side' }).waitFor();
      assert.ok(saved.documents.length === 2 && saved.onboardingData.documentNames.cnic_back === 'cnic-back.png');
      // View opens a zoomable, closable preview of the current image.
      await page.getByRole('button', { name: 'View', exact: true }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.match(await dialog.locator('img').getAttribute('src'), /cnic_front0$/);
      await dialog.getByRole('button', { name: 'Zoom in' }).click();
      await dialog.getByRole('button', { name: 'Zoom out' }).waitFor();
      await shot('2-identity-preview');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      // Replace uses the card button, uploads, and the card switches to the new document.
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Replace', exact: true }).first().click();
      await (await chooser).setFiles({ ...png, name: 'new-front.png' });
      await page.getByText('new-front.png').waitFor();
      const frontSrc = await page.getByRole('img', { name: 'Uploaded CNIC front side' }).getAttribute('src');
      assert.match(frontSrc, /cnic_front2$/, 'replacement shows the new image, not the old one');
      await noOverflow(); await shot('2-identity');
      await cont.click();

      // Step 3: defaults reuse shop address/contact; different return address reveals fields.
      await page.getByRole('switch', { name: /Pickup from my shop address/ }).waitFor();
      assert.equal(await page.getByRole('switch', { name: /Pickup from my shop address/ }).isChecked(), true);
      await shot('3-pickup');
      await page.getByText('Return address same as pickup').click();
      await page.getByLabel(/^Address/).fill('456 Return Street');
      await page.getByRole('combobox', { name: 'City' }).fill('Karachi');
      await page.getByRole('combobox', { name: 'City' }).press('Escape');
      assert.equal(await page.getByLabel(/^Province/).inputValue(), 'Sindh');
      await page.getByLabel(/^Contact person/).fill('Returns Desk');
      await page.getByLabel(/^Contact phone/).fill('3009876543');
      await noOverflow();
      await cont.click();
      await page.getByLabel(/^Account number/).waitFor();
      assert.equal(saved.pickupAddress, 'Shop 12, Main Market', 'pickup copied from shop');
      assert.equal(saved.pickupPhone, saved.phone);
      assert.equal(saved.returnCity, 'Karachi');

      // Step 4: payout.
      assert.equal(await page.getByLabel(/^Account title/).inputValue(), 'Test Seller');
      await page.getByLabel(/^Choose your bank/).selectOption('Meezan Bank');
      await page.getByLabel(/^Account number/).fill('01234567894567');
      await noOverflow(); await shot('4-payout');
      await cont.click();

      // Step 5: masked review, edit returns to step, Save & Review comes back.
      await page.getByRole('button', { name: /Submit for Approval/ }).waitFor();
      const review = await page.locator('main').innerText();
      assert.ok(!review.includes('35202-1234567-1') && !review.includes('01234567894567'), 'sensitive data masked');
      assert.ok(review.includes('•••• 4567'));
      await shot('5-review');
      await page.getByRole('button', { name: /Submit for Approval/ }).click();
      await page.getByText('I confirm my details are correct.').waitFor();
      assert.ok(await page.getByText('Confirm that your details are accurate before submitting.').count());
      await page.getByRole('button', { name: 'Edit' }).nth(3).click();
      await page.getByLabel(/^Account title/).fill('Hamid Khan');
      await page.getByRole('button', { name: /Save & Review/ }).click();
      await page.getByRole('button', { name: /Submit for Approval/ }).waitFor();
      assert.equal(saved.accountTitle, 'Hamid Khan');
      await page.getByText('I confirm my details are correct.').click();
      await page.getByRole('button', { name: /Submit for Approval/ }).click();
      await page.waitForFunction(() => window.__destination === '/vendor/status');

      // Registered business: extra fields and document appear only then; resume lands on saved step.
      saved = { ...saved, onboardingData: { ...saved.onboardingData, step: 1 }, businessType: 'company', documents: [{ id: 'a', documentType: 'cnic_front' }, { id: 'b', documentType: 'cnic_back' }] };
      await page.reload();
      await page.getByLabel(/^Registered business name/).waitFor();
      assert.equal(await page.getByText('Registration document', { exact: true }).count(), 1);
      await cont.click();
      await page.locator('#businessRegNo-error').waitFor();
      assert.ok(await page.locator('#businessRegNo-error').count());
      await page.getByLabel(/^Registered business name/).fill('Khan Traders');
      await page.getByLabel(/^Registration number/).fill('REG-1234');
      await page.locator('input[name=license]').setInputFiles(png);
      await noOverflow(); await shot('2-identity-company');
      await cont.click();
      await page.getByRole('switch', { name: /Pickup from my shop address/ }).waitFor();
      assert.equal(saved.businessRegNo, 'REG-1234');
      const button = await cont.boundingBox();
      assert.ok(button.height >= 44 && button.x + button.width <= width);
      assert.deepEqual(clientErrors, []);
      console.log(`PASS ${width}px: blank and prefilled records, validation focus, save failure/expiry, uploads, pickup/return toggles, payout, masked review, edit and resume, individual and registered business, submit`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });