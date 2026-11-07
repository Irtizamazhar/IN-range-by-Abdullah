// LOCAL ONLY: disposable release, write-blocking DB fixture and intercepted Google script.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const root = process.cwd(), cache = path.join(root, 'node_modules/.cache');
const fixture = await fs.mkdtemp(path.join(cache, 'analytics-fixture-'));
const release = path.join(fixture, 'release'), storage = path.join(fixture, 'durable');
let child, browser;
try {
  await fs.mkdir(release); await fs.mkdir(storage);
  await fs.cp(path.join(cache, 'joro-ga4-build'), path.join(release, '.next'), { recursive: true, filter: p => path.basename(p) !== 'cache' });
  for (const name of ['next.config.mjs', 'package.json']) await fs.copyFile(path.join(root, name), path.join(release, name));
  await fs.cp(path.join(root, 'public'), path.join(release, 'public'), { recursive: true, filter: p => path.basename(p) !== 'uploads' });
  await fs.symlink(path.join(root, 'node_modules'), path.join(release, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const socket = net.createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--require', path.join(root, 'scripts/fixtures/seo-prisma.cjs'), path.join(root, 'node_modules/next/dist/bin/next'), 'start', release, '-H', '127.0.0.1', '-p', String(port)], {
    cwd: release, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'production', JORO_NEXT_DIST_DIR: '',
      DATABASE_URL: 'mysql://fixture:fixture@127.0.0.1:9/fixture', UPLOADS_DIR: storage, JORO_DEPLOY_MIGRATIONS: 'false', MAINTENANCE_MODE: 'false',
      NEXTAUTH_SECRET: 'local-analytics-fixture-secret-not-production', NEXTAUTH_URL: base, NEXT_PUBLIC_APP_URL: base, ADMIN_SECRET_PATH: '/fixture-control' },
  });
  let ready = false; child.stdout.on('data', d => { if (String(d).includes('Ready in')) ready = true; }); child.stderr.resume();
  const deadline = Date.now() + 45000;
  while (!ready) { if (child.exitCode !== null || Date.now() > deadline) throw new Error('Local fixture server failed'); await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true });
  const results = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    let loads = 0, googleReferrers = 0;
    await context.route('https://www.googletagmanager.com/**', async route => {
      loads++; if (route.request().headers().referer) googleReferrers++;
      await route.fulfill({ contentType: 'text/javascript', body: 'window.__joroGoogleStub=true;' });
    });
    await context.route('**://*.google-analytics.com/**', route => route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const count = () => page.evaluate(() => (window.dataLayer || []).filter(a => a[0] === 'event' && a[1] === 'page_view').length);
    const waitCount = n => page.waitForFunction(n => (window.dataLayer || []).filter(a => a[0] === 'event' && a[1] === 'page_view').length === n, n);
    const disabled = () => page.evaluate(() => window['ga-disable-G-BKBH6NHEY4']);
    const disclosure = await context.request.get(base + '/privacy-policy');
    assert.equal(disclosure.status(), 200);
    assert.ok((await disclosure.text()).includes('Optional Google Analytics'));
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('link', { name: 'Privacy policy', exact: true }).getAttribute('href'), '/privacy-policy');
    await page.getByRole('button', { name: 'Reject optional analytics', exact: true }).click();
    assert.equal(loads, 0); assert.equal(await count(), 0);
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(loads, 0);
    await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
    await page.getByRole('button', { name: 'Accept optional analytics', exact: true }).click();
    await waitCount(1); assert.equal(loads, 1); assert.equal(googleReferrers, 0);
    await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
    await page.keyboard.press('Escape'); assert.equal(await count(), 1);
    await page.locator('a[href="/products"]:visible').first().click(); await page.waitForURL('**/products'); await waitCount(2);
    await page.goBack(); await waitCount(3); await page.goForward(); await waitCount(4);
    await page.evaluate(() => history.replaceState(null, '', '/products?page=2&utm_source=secret-name'));
    await page.waitForTimeout(100); assert.equal(await count(), 4);
    await page.evaluate(() => history.pushState(null, '', '/checkout?email=secret@example.invalid'));
    await page.waitForFunction(() => window['ga-disable-G-BKBH6NHEY4'] === true); assert.equal(await count(), 4);
    await page.evaluate(() => history.pushState(null, '', '/products/03001234567'));
    await waitCount(5);
    assert.ok(!(await page.evaluate(() => JSON.stringify(window.dataLayer))).includes('03001234567'));
    assert.ok(!(await page.evaluate(() => JSON.stringify(window.dataLayer))).includes('secret'));
    await context.addCookies(['_ga', '_ga_BKBH6NHEY4', 'essential_fixture'].map(name => ({ name, value: 'keep-or-remove', url: base })));
    await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
    await page.getByRole('button', { name: 'Reject optional analytics', exact: true }).click();
    assert.equal(await disabled(), true);
    assert.equal(await page.evaluate(() => [...window.dataLayer].reverse().find(a => a[0] === 'consent' && a[1] === 'update')[2].analytics_storage), 'denied');
    const cookies = await context.cookies(); assert.ok(cookies.some(c => c.name === 'essential_fixture')); assert.ok(!cookies.some(c => c.name === '_ga' || c.name === '_ga_BKBH6NHEY4'));
    await page.evaluate(() => history.pushState(null, '', '/products')); await page.waitForTimeout(100); assert.equal(await count(), 5);
    await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
    await page.getByRole('button', { name: 'Accept optional analytics', exact: true }).click(); await waitCount(6); assert.equal(loads, 1);
    const other = await context.newPage(); await other.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
    await page.getByRole('button', { name: 'Reject optional analytics', exact: true }).click();
    await other.waitForFunction(() => window['ga-disable-G-BKBH6NHEY4'] === true); await other.close();
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await count(), 0);
    await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
    await page.getByRole('button', { name: 'Accept optional analytics', exact: true }).click(); await waitCount(1);
    await page.reload({ waitUntil: 'networkidle' }); await waitCount(1);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#joro-ga4').length), 1);
    assert.deepEqual(errors, []);
    results.push({ width, consentRejectionWithdrawal: true, crossTabWithdrawal: true, navigationDeduplication: true, privateRouteDisabled: true, sanitized: true, hydrationErrors: 0, googleRequestsBeforeConsent: 0 });
    await context.close();
  }
  const context = await browser.newContext();
  let attempted = 0; await context.route('https://www.googletagmanager.com/**', route => { attempted++; return route.abort(); });
  await context.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('storage disabled'); }; Storage.prototype.setItem = () => { throw new Error('storage disabled'); }; });
  const page = await context.newPage(); await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Accept optional analytics', exact: true }).click();
  await page.waitForFunction(() => window['ga-disable-G-BKBH6NHEY4'] === true && document.querySelector('#joro-ga4'));
  assert.equal(attempted, 1); assert.equal(await page.locator('body').isVisible(), true); await context.close();
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Fixture audit timed out')), 5000);
    child.once('message', msg => { clearTimeout(timeout); try { assert.equal(msg.blockedWrites, 0); resolve(); } catch (e) { reject(e); } }); child.send({ type: 'seo-fixture', failReads: false }); });
  console.log(JSON.stringify({ results, storageAndNetworkFailureNonBlocking: true, databaseWrites: 0, googleScriptStubbed: true, actualGAIngestionVerified: false }, null, 2));
} finally {
  await browser?.close();
  if (child && child.exitCode === null) { const ended = new Promise(r => child.once('exit', r)); child.kill(); await ended; }
  if (path.dirname(fixture) === cache && path.basename(fixture).startsWith('analytics-fixture-')) await fs.rm(fixture, { recursive: true, force: true });
}
