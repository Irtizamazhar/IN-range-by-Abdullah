/** Read-only smoke test against the running local app; no credentials or writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

async function main() {
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    assert.equal(route.request().method(), 'GET', 'smoke test must never mutate the database');
    return route.continue();
  });
  try {
    await page.goto(`${base}/wants`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.getByRole('heading', { name: 'Discover what people need', exact: true }).waitFor();
    await page.locator('[data-want-post]').first().waitFor();
    assert.ok(await page.locator('[data-want-post]').count());
    const first = await page.request.get(`${base}/api/wants/feed?limit=2`);
    assert.equal(first.status(), 200);
    const batch = await first.json();
    assert.ok(batch.wants.length <= 2);
    if (batch.hasMore) {
      const second = await page.request.get(`${base}/api/wants/feed?limit=2&cursor=${encodeURIComponent(batch.nextCursor)}`);
      assert.equal(second.status(), 200);
      const next = await second.json();
      assert.equal(next.wants.some(want => batch.wants.some(previous => previous.id === want.id)), false);
    }
    fs.mkdirSync('coverage/wants-live', { recursive: true });
    await page.screenshot({ path: 'coverage/wants-live/desktop.png' });
    const details = page.getByRole('link', { name: 'View details', exact: true }).last();
    await details.scrollIntoViewIfNeeded();
    const savedScroll = await page.evaluate(() => window.scrollY);
    await details.click();
    await page.getByRole('heading', { name: 'Want details', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Back to Wants' }).click();
    await page.locator('[data-want-post]').first().waitFor();
    await page.waitForFunction(y => Math.abs(window.scrollY - y) < 12, savedScroll);
    await page.getByRole('button', { name: 'Nearby', exact: true }).click();
    await page.getByRole('heading', { name: 'Find needs close to you' }).waitFor();
    await page.getByLabel('Filter by city', { exact: true }).fill(batch.wants[0].city);
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.locator('[data-want-post]').first().waitFor();
    assert.ok(new URL(page.url()).searchParams.get('city'));
    await page.getByRole('button', { name: 'My Wants', exact: true }).click();
    await page.getByRole('heading', { name: 'Your Wants, all in one place' }).waitFor();
    await page.getByRole('button', { name: 'All Wants', exact: true }).click();
    await page.locator('[data-want-post]').first().waitFor();
    const before = page.url();
    await page.getByRole('button', { name: 'Post a Want', exact: true }).first().click();
    await page.getByRole('dialog', { name: 'Post a Want' }).waitFor();
    await page.getByRole('heading', { name: 'Sign in to post a Want', exact: true }).waitFor();
    assert.equal(page.url(), before);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Post a Want', exact: true }).waitFor({ state: 'detached' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'coverage/wants-live/mobile.png' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
    const cta = page.getByRole('button', { name: 'Want Post Karo', exact: true }).filter({ visible: true }).first();
    await cta.click();
    await page.getByRole('dialog', { name: 'Post a Want' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
    const sell = page.getByRole('link', { name: 'Sell on JORO', exact: true }).filter({ visible: true }).first();
    await sell.hover();
    assert.equal(await sell.evaluate(node => getComputedStyle(node).textDecorationLine), 'none');
    await page.getByRole('link', { name: 'Wants', exact: true }).filter({ visible: true }).first().click();
    await page.getByRole('heading', { name: 'Discover what people need', exact: true }).waitFor();
    await page.locator('[data-want-post]').first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/wants');
    assert.deepEqual(errors, []);
    console.log('PASS live Next app: real paginated feed, tabs/city, guest My Wants, posting popup on feed/home, responsive layout, Sell CTA hover, no runtime errors');
  } catch (error) {
    fs.mkdirSync('coverage/wants-live', { recursive: true });
    await page.screenshot({ path: 'coverage/wants-live/failure.png' });
    console.error('Browser diagnostics:', JSON.stringify({ errors, text: await page.locator('body').innerText() }));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
