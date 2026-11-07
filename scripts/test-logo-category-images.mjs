// Isolated local production server, read-only Prisma fixture, copied originals only.
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
const fixture = await fs.mkdtemp(path.join(cache, 'logo-category-fixture-'));
const release = path.join(fixture, 'release'), storage = path.join(fixture, 'durable');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const categorySource = path.join(root, 'public/uploads/categories/1774945844940-image.png');
const category = await fs.readFile(categorySource), logo = await fs.readFile(path.join(root, 'public/logo.png'));
let child, browser, serverErrors = '';
const measurements = [];
try {
  await fs.mkdir(release); await fs.mkdir(path.join(storage, 'categories'), { recursive: true });
  await fs.writeFile(path.join(storage, 'categories/current.png'), category, { flag: 'wx' });
  await fs.cp(path.join(cache, 'joro-logo-category-build'), path.join(release, '.next'), { recursive: true, filter: p => path.basename(p) !== 'cache' });
  for (const name of ['next.config.mjs', 'package.json']) await fs.copyFile(path.join(root, name), path.join(release, name));
  await fs.cp(path.join(root, 'public'), path.join(release, 'public'), { recursive: true, filter: p => path.basename(p) !== 'uploads' });
  await fs.symlink(path.join(root, 'node_modules'), path.join(release, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const folder of ['categories', 'vendor-docs', 'payment-proofs']) {
    await fs.mkdir(path.join(release, 'public/uploads', folder), { recursive: true });
    await fs.writeFile(path.join(release, 'public/uploads', folder, 'historical.png'), category, { flag: 'wx' });
  }
  const preload = path.join(fixture, 'database-fixture.cjs');
  await fs.writeFile(preload, `require(${JSON.stringify(path.join(root, 'scripts/fixtures/seo-prisma.cjs'))});
const base=globalThis.prisma;
globalThis.prisma=new Proxy(base,{get(target,model){if(model==='productImage')return {findUnique:async args=>args.where.id==='private-fixture'?{id:'private-fixture',productId:null,product:null,mimeType:'image/png',data:Buffer.from(${JSON.stringify(category.toString('base64'))},'base64')}:null};if(model!=='category')return target[model];return new Proxy(target[model],{get(reader,op){
if(!['findMany','findFirst','findUnique'].includes(op))return reader[op];return async args=>{const result=await reader[op](args);const image=row=>row&&({...row,image:row.slug==='public-category-5'?'/uploads/categories/missing.png':'/uploads/categories/current.png'});return Array.isArray(result)?result.map(image):image(result)};
}})}});`);
  const socket = net.createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--require', preload, path.join(root, 'node_modules/next/dist/bin/next'), 'start', release, '-H', '127.0.0.1', '-p', String(port)], {
    cwd: release, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'production', JORO_NEXT_DIST_DIR: '',
      DATABASE_URL: 'mysql://fixture:fixture@127.0.0.1:9/fixture', UPLOADS_DIR: storage, JORO_DEPLOY_MIGRATIONS: 'false', MAINTENANCE_MODE: 'false',
      NEXTAUTH_SECRET: 'local-logo-category-fixture-secret-not-production', NEXTAUTH_URL: base, NEXT_PUBLIC_APP_URL: base, ADMIN_SECRET_PATH: '/fixture-control', ADMIN_EMAIL: 'fixture-admin@example.invalid' },
  });
  let ready = false; child.stdout.on('data', d => { if (String(d).includes('Ready in')) ready = true; }); child.stderr.on('data', d => { serverErrors += String(d); });
  const deadline = Date.now() + 45000;
  while (!ready) { if (child.exitCode !== null || Date.now() > deadline) throw new Error('Local fixture server failed to start'); await new Promise(r => setTimeout(r, 100)); }
  const sourceCheck = await fetch(base + '/uploads/categories/current.png');
  assert.equal(sourceCheck.status, 200, `Fixture source status ${sourceCheck.status}: ${sourceCheck.status === 200 ? '' : (await sourceCheck.text()).slice(0, 150)} ${sourceCheck.status === 200 ? '' : serverErrors.slice(-1800)}`);
  assert.equal(sha(Buffer.from(await sourceCheck.arrayBuffer())), sha(category));
  const optimized = (url, w) => base + '/_next/image?' + new URLSearchParams({ url, w: String(w), q: '75' });
  for (const [url, w, original] of [['/uploads/categories/current.png', 96, category], ['/uploads/categories/current.png', 256, category], ['/logo.png', 256, logo], ['/logo.png', 3840, logo]]) {
    const cold = await fetch(optimized(url, w), { headers: { accept: 'image/webp' } });
    assert.equal(cold.status, 200, `${url} width ${w}: ${cold.status === 200 ? '' : await cold.text()}`); assert.match(cold.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await cold.arrayBuffer());
    // Next persists the derivative asynchronously after sending the cold response.
    await new Promise(r => setTimeout(r, 150));
    const warm = await fetch(optimized(url, w), { headers: { accept: 'image/webp' } });
    assert.equal(warm.headers.get('x-nextjs-cache'), 'HIT');
    assert.equal(sha(Buffer.from(await warm.arrayBuffer())), sha(bytes));
    const metadata = await sharp(bytes).metadata();
    // Compare visible pixels on white; transparent RGB values are not visible fidelity.
    const reference = await sharp(original).resize({ width: metadata.width }).flatten({ background: '#ffffff' }).raw().toBuffer();
    const decoded = await sharp(bytes).flatten({ background: '#ffffff' }).raw().toBuffer();
    assert.equal(reference.length, decoded.length);
    let mse = 0; for (let i = 0; i < reference.length; i++) mse += (reference[i] - decoded[i]) ** 2;
    mse /= reference.length; const psnr = mse === 0 ? 100 : 10 * Math.log10(255 ** 2 / mse);
    assert.ok(psnr >= 28, `Image fidelity regression for ${url} at ${w}px: ${psnr}dB`);
    measurements.push({ url, width: w, originalBytes: original.length, optimizedBytes: bytes.length, psnrDb: Math.round(psnr * 10) / 10, format: metadata.format, cold: cold.headers.get('x-nextjs-cache'), warm: 'HIT' });
  }
  for (const url of ['/uploads/categories/current.png', '/uploads/categories/historical.png']) {
    const r = await fetch(base + url); assert.equal(r.status, 200); assert.equal(sha(Buffer.from(await r.arrayBuffer())), sha(category));
    assert.equal((await fetch(optimized(url, 96), { headers: { accept: 'image/webp' } })).status, 200);
  }
  for (const url of ['/uploads/categories/missing.png', '/uploads/vendor-docs/historical.png', '/uploads/payment-proofs/historical.png', '/api/image/private-fixture', '/uploads/categories/%2e%2e/vendor-docs/historical.png']) {
    const r = await fetch(optimized(url, 96), { headers: { accept: 'image/webp' } });
    assert.notEqual(r.status, 200, url); assert.ok(!r.headers.get('content-type')?.startsWith('image/')); await r.body.cancel();
  }
  const token = await require('next-auth/jwt').encode({ secret: 'local-logo-category-fixture-secret-not-production', maxAge: 120,
    token: { sub: 'fixture-admin', email: 'fixture-admin@example.invalid', role: 'admin' } });
  const admin = { cookie: `__Secure-next-auth.session-token.admin=${token}` };
  const protectedSource = await fetch(base + '/api/image/private-fixture', { headers: admin });
  assert.equal(protectedSource.status, 200, 'authenticated private fixture must exist');
  assert.equal(sha(Buffer.from(await protectedSource.arrayBuffer())), sha(category));
  const protectedVariant = await fetch(optimized('/api/image/private-fixture', 96), { headers: { ...admin, accept: 'image/webp' } });
  assert.notEqual(protectedVariant.status, 200, 'optimizer must not cache authenticated private files');
  assert.ok(!protectedVariant.headers.get('content-type')?.startsWith('image/')); await protectedVariant.body.cancel();
  const executablePath = process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  browser = await chromium.launch({ executablePath, headless: true });
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    const link = page.locator('a[href="/categories/phones"]');
    await link.first().scrollIntoViewIfNeeded();
    const img = link.first().locator('img'); await img.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('a[href="/categories/phones"] img')].some(i => i.complete && i.naturalWidth > 0));
    assert.match(await img.getAttribute('srcset'), /96w/);
    assert.equal(await img.getAttribute('sizes'), '(min-width: 640px) 76px, 80px');
    const box = await img.boundingBox(); assert.equal(Math.round(box.width), width < 640 ? 76 : 72); // border-box circle has a 2px border
    const missing = page.locator('a[href="/categories/public-category-5"]').first(); await missing.scrollIntoViewIfNeeded();
    await missing.locator('img').waitFor({ state: 'detached' });
    assert.equal(await missing.locator('span[aria-hidden="true"]').textContent(), 'F');
    const scroller = link.first().locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]');
    await page.mouse.move(0, 0); const before = await scroller.evaluate(e => e.scrollLeft);
    await page.waitForTimeout(600); const after = await scroller.evaluate(e => e.scrollLeft);
    const overflowing = await scroller.evaluate(e => e.scrollWidth > e.clientWidth + 1);
    if (overflowing) assert.notEqual(before, after, 'overflowing categories still auto-scroll');
    else assert.equal(before, after, 'categories that fit stay still');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
    const stopped = await scroller.evaluate(e => e.scrollLeft); await page.waitForTimeout(250);
    assert.equal(await scroller.evaluate(e => e.scrollLeft), stopped);
    const footer = page.locator('footer img').first(); assert.equal(await footer.getAttribute('fetchpriority'), null);
    await link.first().click(); await page.waitForURL('**/categories/phones');
    assert.deepEqual(errors, []); await page.close();
    console.log(`PASS ${width}px category image sizing, fallback, navigation, scrolling/reduced-motion, footer priority and hydration`);
  }
  assert.equal(sha(await fs.readFile(categorySource)), sha(category));
  assert.equal(sha(await fs.readFile(path.join(root, 'public/logo.png'))), sha(logo));
  assert.equal(sha(await fs.readFile(path.join(storage, 'categories/current.png'))), sha(category));
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Fixture audit timed out')), 5000);
    child.once('message', msg => { clearTimeout(timeout); try { assert.equal(msg.blockedWrites, 0); resolve(); } catch (e) { reject(e); } }); child.send({ type: 'seo-fixture', failReads: false }); });
  console.log(JSON.stringify({ measurements, originalChecksumsUnchanged: true, databaseWrites: 0, privateFilesRejected: true }, null, 2));
} finally {
  await browser?.close();
  if (child && child.exitCode === null) { const ended = new Promise(r => child.once('exit', r)); child.kill(); await ended; }
  // Remove only this invocation's disposable fixture, never application uploads.
  if (path.dirname(fixture) === cache && path.basename(fixture).startsWith('logo-category-fixture-')) await fs.rm(fixture, { recursive: true, force: true });
}
