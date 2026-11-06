// Production HTTP checks against isolated, read-only fixtures, never a live database.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import net from 'node:net';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
const root = process.cwd();
const parent = path.join(root, 'node_modules/.cache');
const temporary = await fs.mkdtemp(path.join(parent, 'seo-http-'));
const release = path.join(temporary, 'release');
await fs.mkdir(release);
await fs.cp(path.join(parent, 'joro-seo-build'), path.join(release, '.next'), { recursive: true, filter: source => path.basename(source) !== 'cache' });
for (const name of ['next.config.mjs', 'package.json']) await fs.copyFile(path.join(root, name), path.join(release, name));
await fs.cp(path.join(root, 'public'), path.join(release, 'public'), { recursive: true, filter: source => path.basename(source) !== 'uploads' });
await fs.symlink(path.join(root, 'node_modules'), path.join(release, 'node_modules'), 'junction');
let child;
let passed = 0;
async function start(maintenance) {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  child = spawn(process.execPath, ['--require', path.join(root, 'scripts/fixtures/seo-prisma.cjs'), path.join(root, 'node_modules/next/dist/bin/next'), 'start', release, '-H', '127.0.0.1', '-p', String(port)], {
    cwd: release, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'production', JORO_NEXT_DIST_DIR: '', DATABASE_URL: 'mysql://fixture:fixture@127.0.0.1:9/fixture', JORO_DEPLOY_MIGRATIONS: 'false', MAINTENANCE_MODE: String(maintenance), ADMIN_SECRET_PATH: '/fixture-control', NEXTAUTH_SECRET: 'isolated-seo-fixture-secret-not-production', NEXTAUTH_URL: `http://127.0.0.1:${port}` },
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const deadline = Date.now() + 45000;
  while (!log.includes('Ready in')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error('Isolated Next server did not start: ' + log.slice(-2000));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return `http://127.0.0.1:${port}`;
}
async function fixture(failReads, emptyHomeCategories = false) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fixture acknowledgement timeout')), 5000);
    child.once('message', message => { clearTimeout(timeout); assert.equal(message.blockedWrites, 0); resolve(); });
    child.send({ type: 'seo-fixture', failReads, emptyHomeCategories });
  });
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill(); await exited;
}
async function check(label, fn) { await fn(); passed++; console.log('PASS ' + label); }
async function rejectedPage(response) {
  const body = await response.text();
  // Existing root Suspense streams the shell first. Next adds robots=noindex
  // for streamed notFound responses (HTTP 200); non-streamed responses use 404.
  assert.ok(response.status === 404 || response.status === 200 && /<meta name="robots" content="noindex"/.test(body));
  assert.ok(!body.includes('PRIVATE REQUEST MUST NOT LEAK'));
}
try {
  let origin = await start(false);
  await check('database failure returns explicit non-cacheable sitemap 503', async () => {
    await fixture(true);
    const response = await fetch(origin + '/sitemap.xml');
    assert.equal(response.status, 503); assert.match(response.headers.get('cache-control'), /no-store/);
    await fixture(false);
  });
  await check('robots exposes the canonical sitemap and no private admin route', async () => {
    const response = await fetch(origin + '/robots.txt');
    assert.equal(response.status, 200); const body = await response.text();
    assert.match(body, /Sitemap: https:\/\/joro.pk\/sitemap.xml/); assert.ok(!body.includes('fixture-control'));
  });
  const index = await fetch(origin + '/sitemap.xml');
  assert.equal(index.status, 200);
  const children = [...(await index.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  const urls = [];
  for (const url of children) {
    const response = await fetch(origin + new URL(url).pathname);
    assert.equal(response.status, 200, url);
    urls.push(...[...(await response.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]));
  }
  await check('sitemaps include only public fixtures and real canonical routes', async () => {
    for (const suffix of ['/products/seo-p-01', '/categories/phones', '/services/public-service', '/stores/fixture-store', '/wants/public-want']) assert.ok(urls.includes('https://joro.pk' + suffix), suffix);
    assert.ok(!urls.some(url => /inactive-product|unapproved-product|pending-service|pending-store|private-want|expired-want|privacy-policy|terms-and-conditions|\/sell$/.test(url)));
  });
  await check('every homepage category destination is populated, canonical, indexable and in the sitemap', async () => {
    const home = await (await fetch(origin + '/')).text();
    const destinations = [...new Set([...home.matchAll(/href="(\/categories\/[^"?#]+)"/g)].map(match => match[1]))];
    assert.deepEqual(destinations.sort(), ['/categories/phones', ...Array.from({ length: 6 }, (_, i) => `/categories/public-category-${i}`)].sort());
    for (const pathname of destinations) {
      const response = await fetch(origin + pathname);
      assert.equal(response.status, 200, pathname);
      const body = await response.text();
      assert.ok(body.includes(`rel="canonical" href="https://joro.pk${pathname}"`));
      assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(body));
      assert.ok(!response.headers.get('x-robots-tag')?.includes('noindex'));
      assert.match(body, /href="\/products\/[^"?]+"/);
      assert.ok(urls.includes('https://joro.pk' + pathname));
    }
  });
  await check('zero eligible homepage categories retain the existing empty state and product browsing', async () => {
    await fixture(false, true);
    const response = await fetch(origin + '/'); assert.equal(response.status, 200);
    const home = await response.text();
    assert.match(home, /No categories yet/);
    assert.match(home, /href="\/products"/);
    assert.ok(!/href="\/categories\//.test(home));
    await fixture(false);
  });
  for (const url of urls) await check('sitemap target HTTP 200: ' + new URL(url).pathname, async () => {
    const response = await fetch(origin + new URL(url).pathname);
    assert.equal(response.status, 200); const body = await response.text();
    const canonical = body.match(/rel="canonical" href="([^"]+)"/)?.[1];
    assert.ok(canonical, 'canonical missing: ' + url);
    assert.equal(new URL(canonical).href, new URL(url).href);
    assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(body), 'accidental public noindex');
    assert.match(body, /property="og:title"/); assert.match(body, /name="twitter:title"/);
    const schemas = [...body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    if (url.endsWith('/services/public-service')) assert.ok(schemas.some(value => value['@type'] === 'Service'));
    if (url.endsWith('/stores/fixture-store')) assert.ok(schemas.some(value => value['@type'] === 'Organization'));
  });
  await check('server-rendered products and crawlable pagination', async () => {
    const body = await (await fetch(origin + '/products')).text();
    assert.match(body, /href="\/products\/seo-p-/); assert.match(body, /href="\/products\?page=2"/);
    const page2 = await fetch(origin + '/products?page=2'); assert.equal(page2.status, 200);
    assert.ok((await page2.text()).includes('href="https://joro.pk/products?page=2"'));
    await rejectedPage(await fetch(origin + '/products?page=999'));
  });
  for (const suffix of ['/products/inactive-product', '/products/unapproved-product', '/services/pending-service', '/stores/pending-store', '/wants/private-want', '/wants/expired-want', ...['empty-category', 'inactive-category', 'inactive-product-category', 'pending-category', 'suspended-category', 'private-category', 'missing-category'].map(slug => '/categories/' + slug)]) await check('non-public record rejected with noindex: ' + suffix, async () => {
    await rejectedPage(await fetch(origin + suffix));
  });
  await check('actual Product/Offer JSON-LD and safely escaped output', async () => {
    const body = await (await fetch(origin + '/products/seo-p-01')).text();
    const data = [...body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    const product = data.flat().find(value => value['@type'] === 'Product');
    assert.ok(product); assert.equal(product.offers.priceCurrency, 'PKR'); assert.equal(product.offers.availability, 'https://schema.org/OutOfStock'); assert.ok(!product.aggregateRating);
  });
  await check('private and filtered pages carry noindex headers', async () => {
    for (const suffix of ['/cart', '/checkout', '/login', '/products?search=phone']) {
      const response = await fetch(origin + suffix, { redirect: 'manual' });
      assert.match(response.headers.get('x-robots-tag') || '', /noindex/, suffix);
    }
  });
  await fixture(false);
  await check('mobile/desktop product hydration and valid sitemap XML', async () => {
    const executablePath = process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 850 } });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + '/products', { waitUntil: 'networkidle' });
        assert.ok(await page.locator('a[href^="/products/seo-p-"]').count());
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(errors, []);
        const sitemapResponse = await fetch(origin + '/sitemap.xml');
        const xml = await sitemapResponse.text();
        assert.equal(await page.evaluate(value => new DOMParser().parseFromString(value, 'application/xml').querySelectorAll('parsererror').length, xml), 0);
        await page.goto(origin + '/', { waitUntil: 'networkidle' });
        const categories = page.getByRole('list', { name: 'Product categories' });
        assert.equal(await categories.locator('a').count(), 7);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (width === 390) {
          const scroll = categories.locator('..');
          await scroll.hover();
          const before = await scroll.evaluate(node => node.scrollLeft);
          await page.getByRole('button', { name: 'Scroll categories right' }).click();
          await page.waitForFunction(previous => document.querySelector('[aria-label="Product categories"]').parentElement.scrollLeft !== previous, before);
        }
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally { await browser.close(); }
  });
  await stop(); origin = await start(true);
  await check('maintenance keeps sitemap unavailable and homepage noindex', async () => {
    assert.equal((await fetch(origin + '/sitemap.xml')).status, 503);
    assert.match(await (await fetch(origin + '/robots.txt')).text(), /Disallow: \//);
    assert.match((await fetch(origin + '/')).headers.get('x-robots-tag') || '', /noindex/);
  });
  await fixture(false);
  console.log(`PASS ${passed} isolated production HTTP checks; database writes: 0`);
} finally {
  await stop();
  // Only this run's mkdtemp directory is removed. Original images/build are untouched.
  if (path.dirname(temporary) === parent && path.basename(temporary).startsWith('seo-http-')) await fs.rm(temporary, { recursive: true, force: true });
}
