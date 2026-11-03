/* Real Profile page and controls, mocked HTTP APIs. No database, uploads or mail. */
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

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const build = await esbuild.build({
    stdin: { contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import {Toaster} from "react-hot-toast"; import Page from "./app/vendor/dashboard/profile/page"; createRoot(document.getElementById("root")).render(<><Page/><Toaster/></>);', resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, outfile: 'page.js', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'next-fixture', setup(builder) {
      builder.onResolve({ filter: /^@\/hooks\/useLoadingRouter$/ }, () => ({ path: 'router', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/components\/ui\/LoadingLink$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ loader: 'tsx', resolveDir: root, contents: name === 'router' ? 'export const useLoadingRouter=()=>({push:async()=>{},refresh:()=>{window.__refreshed=(window.__refreshed||0)+1;}});' : 'import React from "react"; export default function Link(props){return <a {...props}/>;}' }));
    } }],
  });
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  const styles = await postcss([tailwind({ ...config, content: [path.join(root, 'app/vendor/dashboard/profile/page.tsx'), path.join(root, 'components/ui/*.tsx'), path.join(root, 'components/user/SocialIcon.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
  const js = build.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = styles.css + '\n' + (build.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
  const server = http.createServer((req, res) => {
    if (req.url === '/page.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(js); }
    else if (req.url === '/page.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/page.css"></head><body><div id="root"></div><script src="/page.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file => fs.existsSync(file));
  const shots = path.join(root, 'node_modules/.cache/profile-shots');
  fs.mkdirSync(shots, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    for (const width of [375, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const clientErrors = [];
      page.on('pageerror', error => clientErrors.push(error.message));
      let profile = { id: 'v1', status: 'approved', shopName: 'GADGETHUB', storeSlug: 'gadgethub', shopDescription: 'Trendy gadgets', primaryCategory: 'Other', shopLogo: '/uploads/vendor-products/v1/old-logo.png', storeBanner: null, city: 'Taxila', address: 'Main Bazar, Taxila', socialLinks: {} };
      const patches = [];
      let uploadCount = 0;
      let failUpload = false;
      await page.route('**/uploads/**', route => route.fulfill({ contentType: 'image/png', body: PNG }));
      await page.route('**/api/categories', route => route.fulfill({ json: [{ id: 1, name: 'Mobiles & Accessories' }, { id: 2, name: 'Other' }] }));
      await page.route('**/api/vendor/upload', async route => {
        if (failUpload) return route.fulfill({ status: 400, json: { error: 'Image bytes do not match the declared type.' } });
        await new Promise(resolve => setTimeout(resolve, 300));
        return route.fulfill({ json: { url: `/uploads/vendor-products/v1/new-${++uploadCount}.png` } });
      });
      const locationRequests = [];
      await page.route('**/api/vendor/profile/location-request', async route => {
        const body = route.request().postDataJSON();
        locationRequests.push(body);
        return route.fulfill({ json: { success: true, locationRequest: { status: 'PENDING', city: body.city, address: body.address, ticketNumber: 'JORO-10042', ticketHref: '/vendor/dashboard/help/tickets/t1', requestedAt: new Date().toISOString(), reviewedAt: null, reviewNote: null } } });
      });
      await page.route('**/api/vendor/profile', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { profile } });
        const body = route.request().postDataJSON();
        patches.push(body);
        assert.equal('city' in body || 'address' in body || 'storeSlug' in body, false, 'client never sends locked fields');
        const socialLinks = Object.fromEntries(Object.entries(body.socialLinks).filter(([, value]) => value));
        profile = { ...profile, ...body, socialLinks };
        return route.fulfill({ json: { success: true, profile } });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const save = page.getByRole('button', { name: 'Save Changes' }).first();
      const visibleSave = width < 640 ? page.getByRole('button', { name: 'Save Changes' }).last() : save;

      // Existing data loads; location is read-only; save stays disabled until something changes.
      await page.getByText('Registered city').waitFor();
      assert.equal(await page.getByText('Main Bazar, Taxila').count(), 1);
      assert.equal(await page.locator('input[value="Taxila"]').count(), 0, 'city is not editable');
      assert.equal(await visibleSave.isDisabled(), true);
      assert.equal(await page.getByLabel('Store name').inputValue(), 'GADGETHUB');
      await page.getByText('No banner yet').waitFor();

      // Failed upload shows an error and keeps the old logo.
      failUpload = true;
      await page.locator('input[aria-label="Upload Profile Photo (Logo)"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
      await page.getByText('Image bytes do not match the declared type.').waitFor();
      failUpload = false;
      // Wrong type is rejected before uploading.
      await page.locator('input[aria-label="Upload Store Banner"]').setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: PNG });
      await page.getByText('Use a JPG, PNG or WebP image.').waitFor();

      // Upload logo and banner: progress, then green Uploaded status.
      await page.locator('input[aria-label="Upload Profile Photo (Logo)"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
      await page.getByText(/Uploading… \d+%/).first().waitFor();
      await page.getByText('Uploaded — save changes to publish').first().waitFor();
      await page.locator('input[aria-label="Upload Store Banner"]').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: PNG });
      await page.waitForFunction(() => document.querySelectorAll('[role=status]').length && [...document.querySelectorAll('span')].filter(s => s.textContent === 'Uploaded — save changes to publish').length === 2);
      assert.ok(await page.getByText(/may look blurry/).count(), 'small image warns about recommended size');
      const banner = page.getByRole('button', { name: 'Preview Store Banner' });
      const box = await banner.boundingBox();
      assert.ok(Math.abs(box.width / box.height - 3) < 0.05, `banner preview keeps 3:1 (${box.width}x${box.height})`);
      // Preview opens the lightbox.
      await banner.click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });

      // Edit info, category and social links; an invalid link blocks saving with a field error.
      await page.getByLabel('Store name').fill('GadgetHub Pro');
      await page.getByLabel('Store description').fill('Smart gadgets for your everyday life.');
      await page.getByLabel('Primary category').selectOption('Mobiles & Accessories');
      await page.getByLabel('Facebook').fill('facebook.com/gadgethub');
      await page.getByLabel('Facebook').blur();
      assert.equal(await page.getByLabel('Facebook').inputValue(), 'https://facebook.com/gadgethub', 'https is added');
      await page.getByLabel('Instagram').fill('https://facebook.com/wrong');
      await visibleSave.click();
      await page.getByText('Instagram links must be on instagram.com.').waitFor();
      assert.equal(patches.length, 0);
      await page.getByLabel('Instagram').fill('https://instagram.com/gadgethub');
      await shot(page, shots, width, 'edited');
      await visibleSave.click();
      await page.getByText('Profile saved. Your public store is updated.').waitFor();
      assert.equal(patches.length, 1);
      assert.equal(patches[0].shopLogo, '/uploads/vendor-products/v1/new-1.png');
      assert.equal(patches[0].storeBanner, '/uploads/vendor-products/v1/new-2.png');
      assert.equal(patches[0].primaryCategory, 'Mobiles & Accessories');
      assert.equal(await visibleSave.isDisabled(), true, 'clean after save');
      assert.equal(await page.evaluate(() => window.__refreshed), 1, 'layout is refreshed so the top bar logo updates');

      // Replace then remove the banner, remove a social link; Cancel restores, Save persists.
      await page.getByRole('button', { name: 'Replace' }).nth(1).click();
      await page.getByRole('button', { name: 'Remove' }).nth(1).click();
      await page.getByText('No banner yet').waitFor();
      await page.getByRole('button', { name: 'Cancel' }).first().click();
      assert.equal(await page.getByText('No banner yet').count(), 0, 'cancel restores the banner');
      await page.getByRole('button', { name: 'Remove' }).nth(1).click();
      await page.getByLabel('Instagram').fill('');
      await visibleSave.click();
      await page.waitForFunction(() => document.body.innerText.includes('Profile saved.'));
      await page.waitForTimeout(100);
      assert.equal(patches.at(-1).storeBanner, '');
      assert.equal(patches.at(-1).socialLinks.instagram, '');
      assert.equal(patches.at(-1).socialLinks.facebook, 'https://facebook.com/gadgethub');

      // Location change: validated request form, then a pending notice; the registered location stays as is.
      await page.getByRole('button', { name: 'Request change' }).click();
      await page.getByRole('button', { name: 'Send request' }).click();
      await page.getByText('Enter the full new address.').waitFor();
      assert.equal(locationRequests.length, 0);
      await page.getByRole('combobox', { name: 'New city' }).fill('Lahore');
      await page.getByRole('combobox', { name: 'New city' }).press('Escape');
      await page.getByLabel('New address').fill('Shop 4, Hall Road');
      await page.getByLabel('Reason').fill('Shop moved to Lahore');
      await page.getByRole('button', { name: 'Send request' }).click();
      await page.getByText('Change under review').waitFor();
      assert.deepEqual(locationRequests[0], { city: 'Lahore', address: 'Shop 4, Hall Road', reason: 'Shop moved to Lahore' });
      assert.equal(await page.getByText('Main Bazar, Taxila').count(), 1, 'registered address unchanged');
      assert.equal(await page.getByRole('button', { name: 'Request change' }).count(), 0, 'no second request while pending');

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal overflow');
      await shot(page, shots, width, 'saved');
      assert.deepEqual(clientErrors, []);
      console.log(`PASS ${width}px: load, read-only location, upload progress/errors/uploaded state, 3:1 preview, lightbox, info/category/social edits with validation, save, replace/remove, cancel`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
const shot = (page, dir, width, name) => page.screenshot({ path: path.join(dir, `${width}-${name}.png`), fullPage: true });
main().catch(error => { console.error(error); process.exitCode = 1; });
