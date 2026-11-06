// Disposable local originals only. Never imports credentials, connects to a DB, or touches vendor files.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
const require = createRequire(import.meta.url);
const root = process.cwd(), cache = path.join(root, 'node_modules/.cache');
const fixture = await fs.mkdtemp(path.join(cache, 'product-image-fixture-'));
const storage = path.join(fixture, 'durable'), release = path.join(fixture, 'release');
const artifacts = path.join(cache, 'product-image-validation');
await fs.mkdir(storage); await fs.mkdir(release); await fs.mkdir(artifacts, { recursive: true });
const originalUrl = '/uploads/products/fixture-original.png';
const secondUrl = '/uploads/vendor-products/vendor-fixture/fixture-second.png';
const originalPath = path.join(storage, 'products/fixture-original.png');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const width = 1000, height = 1200, pixels = Buffer.alloc(width * height * 3);
let seed = 12345;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = (seed >>> 27) - 16, offset = (y * width + x) * 3;
  pixels[offset] = Math.max(0, Math.min(255, 40 + x * 170 / width + noise));
  pixels[offset + 1] = Math.max(0, Math.min(255, 40 + y * 170 / height + noise));
  pixels[offset + 2] = ((x >> 6) + (y >> 6)) % 2 ? 180 : 70;
}
const original = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
const second = await sharp(original).flop().png().toBuffer();
const privateBytes = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#c04080' } }).png().toBuffer();
await fs.mkdir(path.dirname(originalPath), { recursive: true });
await fs.mkdir(path.join(storage, 'vendor-products/vendor-fixture'), { recursive: true });
await fs.writeFile(originalPath, original, { flag: 'wx' });
await fs.writeFile(path.join(storage, secondUrl.slice(9)), second, { flag: 'wx' });
await fs.cp(path.join(cache, 'joro-seo-build'), path.join(release, '.next'), { recursive: true, filter: source => path.basename(source) !== 'cache' });
for (const name of ['next.config.mjs', 'package.json']) await fs.copyFile(path.join(root, name), path.join(release, name));
await fs.cp(path.join(root, 'public'), path.join(release, 'public'), { recursive: true, filter: source => path.basename(source) !== 'uploads' });
await fs.symlink(path.join(root, 'node_modules'), path.join(release, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
for (const relative of ['products/historical.png', 'vendor-products/legacy-flat.png', 'vendor-docs/cnic.png', 'payment-proofs/proof.png']) {
  const file = path.join(release, 'public/uploads', relative); await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, relative.includes('products') ? original : privateBytes, { flag: 'wx' });
}
const preload = path.join(fixture, 'database-fixture.cjs');
await fs.writeFile(preload, `require(${JSON.stringify(path.join(root, 'scripts/fixtures/seo-prisma.cjs'))});
const base = globalThis.prisma;
const secretImage = Buffer.from(${JSON.stringify(privateBytes.toString('base64'))}, 'base64');
globalThis.prisma = new Proxy(base, { get(target, model) {
  if (model === 'productImage') return { findUnique: async args => args.where.id === 'private-fixture' ? {id:'private-fixture',productId:null,product:null,mimeType:'image/png',data:secretImage} : null };
  if (model !== 'product') return target[model];
  return new Proxy(target[model], { get(reader, operation) {
    if (!['findMany','findFirst','findUnique'].includes(operation)) return reader[operation];
    return async args => { const result=await reader[operation](args); const image=p=>p&&({...p,listingImageUrls:p.id==='seo-p-02'?[]:[${JSON.stringify(originalUrl)},${JSON.stringify(secondUrl)}]});return Array.isArray(result)?result.map(image):image(result); };
  }});
}});`);
let child, browser;
const measurements = [];
try {
  const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`, secret = 'product-image-local-fixture-secret-not-production';
  child = spawn(process.execPath, ['--require', preload, path.join(root, 'node_modules/next/dist/bin/next'), 'start', release, '-H', '127.0.0.1', '-p', String(port)], {
    cwd: release, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'production', JORO_NEXT_DIST_DIR: '', DATABASE_URL: 'mysql://fixture:fixture@127.0.0.1:9/fixture', UPLOADS_DIR: storage, JORO_DEPLOY_MIGRATIONS: 'false', MAINTENANCE_MODE: 'false', NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXT_PUBLIC_APP_URL: base, ADMIN_EMAIL: 'fixture-admin@example.invalid', ADMIN_SECRET_PATH: '/fixture-control' },
  });
  let ready = false; child.stdout.on('data', data => { if (String(data).includes('Ready in')) ready = true; }); child.stderr.resume();
  const deadline = Date.now() + 45000;
  while (!ready) { if (child.exitCode !== null || Date.now() > deadline) throw new Error('Local fixture server did not start'); await new Promise(resolve => setTimeout(resolve, 100)); }
  const optimized = (url, w = 384) => base + '/_next/image?' + new URLSearchParams({ url, w: String(w), q: '75' });
  for (const size of [384, 750]) {
    const cold = await fetch(optimized(originalUrl, size), { headers: { accept: 'image/webp' } });
    assert.equal(cold.status, 200); assert.match(cold.headers.get('content-type'), /image\/webp/);
    assert.equal(cold.headers.get('x-nextjs-cache'), 'MISS');
    const bytes = Buffer.from(await cold.arrayBuffer()), metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, size); assert.ok(bytes.length < original.length * 0.5);
    const reference = await sharp(original).resize({ width: size }).removeAlpha().raw().toBuffer();
    const decoded = await sharp(bytes).removeAlpha().raw().toBuffer();
    assert.equal(reference.length, decoded.length);
    let mse = 0; for (let i = 0; i < reference.length; i++) mse += (reference[i] - decoded[i]) ** 2;
    mse /= reference.length; const psnr = mse === 0 ? 100 : 10 * Math.log10(255 ** 2 / mse);
    assert.ok(psnr >= 28, `Fixture visual difference too large: ${psnr}`);
    const warm = await fetch(optimized(originalUrl, size), { headers: { accept: 'image/webp' } });
    assert.equal(warm.headers.get('x-nextjs-cache'), 'HIT');
    assert.equal(hash(Buffer.from(await warm.arrayBuffer())), hash(bytes));
    measurements.push({ width: size, originalBytes: original.length, optimizedBytes: bytes.length, reductionPercent: Math.round((1 - bytes.length / original.length) * 1000) / 10, psnrDb: Math.round(psnr * 10) / 10, cold: 'MISS', warm: 'HIT' });
    if (size === 384) {
      const a = await sharp(original).resize({ width: size }).png().toBuffer();
      const b = await sharp(bytes).png().toBuffer(); const h = (await sharp(a).metadata()).height;
      await sharp({ create: { width: size * 2, height: h, channels: 3, background: '#ffffff' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: size, top: 0 }]).png().toFile(path.join(artifacts, 'comparison.png'));
    }
  }
  for (const url of [originalUrl, secondUrl, '/uploads/products/historical.png', '/uploads/vendor-products/legacy-flat.png']) {
    const direct = await fetch(base + url); assert.equal(direct.status, 200);
    assert.equal(hash(Buffer.from(await direct.arrayBuffer())), hash(url === secondUrl ? second : original));
    const variant = await fetch(optimized(url), { headers: { accept: 'image/webp' } }); assert.equal(variant.status, 200); await variant.body.cancel();
  }
  const old = Buffer.from(await (await fetch(optimized(originalUrl))).arrayBuffer());
  const replacement = Buffer.from(await (await fetch(optimized(secondUrl))).arrayBuffer());
  assert.notEqual(hash(old), hash(replacement));
  for (const url of ['/uploads/products/missing.png', '/uploads/vendor-docs/cnic.png', '/uploads/payment-proofs/proof.png', '/uploads/products/%2e%2e/vendor-docs/cnic.png']) {
    const response = await fetch(optimized(url), { headers: { accept: 'image/webp' } }); assert.notEqual(response.status, 200, url); assert.ok(!response.headers.get('content-type')?.startsWith('image/')); await response.body.cancel();
  }
  const token = await require('next-auth/jwt').encode({ secret, maxAge: 120, token: { sub: 'fixture-admin', email: 'fixture-admin@example.invalid', role: 'admin' } });
  const admin = { cookie: `__Secure-next-auth.session-token.admin=${token}` };
  const privateDirect = await fetch(base + '/api/image/private-fixture', { headers: admin });
  assert.equal(privateDirect.status, 200, 'Fixture admin must genuinely access the protected source');
  assert.equal(hash(Buffer.from(await privateDirect.arrayBuffer())), hash(privateBytes));
  for (const headers of [{ ...admin, accept: 'image/webp' }, { accept: 'image/webp' }]) {
    const response = await fetch(optimized('/api/image/private-fixture'), { headers });
    assert.notEqual(response.status, 200, 'Protected image must not enter shared optimization cache');
    assert.ok(!response.headers.get('content-type')?.startsWith('image/')); await response.body.cancel();
  }
  console.log('PASS public/historical/replacement images, missing/private paths, authenticated-private cache isolation and cold/warm cache');
  const executablePath = process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width: viewport, height: 900 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/products', '/categories/phones']) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      const image = page.locator(`[data-product-card] img[src*="_next/image"]`).first();
      await image.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-product-card] img')].some(image => image.currentSrc.includes('/_next/image?') && image.complete && image.naturalWidth > 0));
      assert.ok(await image.getAttribute('srcset'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    assert.ok(await page.locator('[data-product-card="seo-p-02"] [data-product-image]').count());
    assert.equal(await page.locator('[data-product-card="seo-p-02"] [data-product-image] img').count(), 0);
    await page.goto(base + '/products/seo-p-01', { waitUntil: 'networkidle' });
    const main = page.getByRole('region', { name: 'Product images' }).locator('img[fetchpriority="high"]');
    await main.waitFor(); await page.waitForFunction(() => document.querySelector('img[fetchpriority="high"][alt="Fixture phone 1"]')?.naturalWidth > 0);
    assert.match(await main.getAttribute('src'), /\/_next\/image\?/);
    await page.getByRole('button', { name: 'Show image 2', exact: true }).click();
    assert.ok((await main.getAttribute('src')).includes('fixture-second'));
    await main.click(); const dialog = page.getByRole('dialog', { name: 'Fixture phone 1 images' }); await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Previous image', exact: true }).click();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport}px home/catalog/category grids, responsive image loads, placeholder and gallery/lightbox`);
    await page.close();
  }
  assert.equal(hash(await fs.readFile(originalPath)), hash(original));
  assert.equal(hash(await fs.readFile(path.join(storage, secondUrl.slice(9)))), hash(second));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fixture audit timed out')), 5000);
    child.once('message', message => { clearTimeout(timeout); try { assert.equal(message.blockedWrites, 0); resolve(); } catch (error) { reject(error); } });
    child.send({ type: 'seo-fixture', failReads: false });
  });
  await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ measurements, originalChecksumsUnchanged: true, privateCacheIsolation: true, databaseWrites: 0 }, null, 2));
  console.log(JSON.stringify({ measurements, originalChecksumsUnchanged: true, databaseWrites: 0, artifacts }));
} finally {
  await browser?.close();
  if (child && child.exitCode === null) { const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended; }
  if (path.dirname(fixture) === cache && path.basename(fixture).startsWith('product-image-fixture-')) await fs.rm(fixture, { recursive: true, force: true });
}
