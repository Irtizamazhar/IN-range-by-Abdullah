// Built Next application + read-only fixtures. No real database or network service.
import { spawn } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const root = process.cwd();
const child = spawn(process.execPath, ['--require', path.join(root, 'scripts/fixtures/seo-prisma.cjs'), path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'mysql://fixture:fixture@127.0.0.1:9/fixture', JORO_DEPLOY_MIGRATIONS: 'false', MAINTENANCE_MODE: 'false', NEXTAUTH_SECRET: 'local-read-only-fixture', NEXTAUTH_URL: `http://127.0.0.1:${port}` },
});
let log = '';
child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
const origin = `http://127.0.0.1:${port}`;
try {
  const deadline = Date.now() + 45000;
  while (!log.includes('Ready in')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error('Fixture server did not start: ' + log.slice(-1500));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  for (const ua of ['Mozilla/5.0', 'Googlebot']) {
    for (const [old, canonical] of [['/products/seo-p-01', '/products/fixture-phone-1'], ['/categories/seo-category', '/categories/phones'], ['/category/seo-category', '/categories/phones'], ['/new-arrivals/1', '/products/fixture-phone-1']]) {
      const response = await fetch(origin + old + '?page=2&token=private', { redirect: 'manual', headers: { 'user-agent': ua } });
      console.log(JSON.stringify({ ua, path: old, status: response.status, location: response.headers.get('location') }));
      assert.equal(response.status, 308);
      assert.equal(new URL(response.headers.get('location'), origin).pathname, canonical);
      assert.equal(new URL(response.headers.get('location'), origin).searchParams.has('token'), false);
      await response.body?.cancel();
    }
    for (const url of ['/products/fixture-phone-1', '/categories/phones', '/sitemap.xml', '/sitemaps/products-0.xml', '/sitemaps/categories-0.xml', '/robots.txt']) {
      const response = await fetch(origin + url, { redirect: 'manual', headers: { 'user-agent': ua } });
      assert.equal(response.status, 200, url); const body = await response.text();
      if (url === '/products/fixture-phone-1') { assert.match(body, /<link rel="canonical" href="https:\/\/joro.pk\/products\/fixture-phone-1"/); assert.match(body, /application\/ld\+json/); }
      if (url === '/categories/phones') assert.match(body, /<link rel="canonical" href="https:\/\/joro.pk\/categories\/phones"/);
      if (url === '/sitemaps/products-0.xml') { assert.match(body, /\/products\/fixture-phone-1/); assert.doesNotMatch(body, /\/products\/seo-p-/); }
    }
    for (const url of ['/products/does-not-exist', '/products/inactive-product', '/products/unapproved-product', '/categories/does-not-exist']) {
      const response = await fetch(origin + url, { headers: { 'user-agent': ua } });
      console.log(JSON.stringify({ ua, path: url, status: response.status }));
      assert.equal(response.status, 404); await response.body?.cancel();
    }
    const spoofed = await fetch(origin + '/products', { headers: { 'user-agent': ua, 'x-joro-catalog-route': '/products/does-not-exist' } });
    assert.equal(spoofed.status, 200); await spoofed.body?.cancel();
  }
  await new Promise((resolve, reject) => { child.once('message', result => { try { assert.equal(result.blockedWrites, 0); resolve(); } catch (e) { reject(e); } }); child.send({ type: 'seo-fixture' }); });
  console.log('PASS: real HTTP 308/200/404, canonicals, sitemaps, robots; zero attempted database writes.');
} finally {
  if (child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
}
