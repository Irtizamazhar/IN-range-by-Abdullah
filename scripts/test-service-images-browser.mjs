/** Offline React/HTTP fixtures: tests actual service components, never live records. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const root = process.cwd();
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{ServiceListings}from'./components/admin/ServiceListings';import Vendor from './app/vendor/dashboard/services/page';import{ServiceCard}from'./components/user/services/ServiceCard';const screen=new URLSearchParams(location.search).get('screen');fetch('/fixture').then(r=>r.json()).then(f=>createRoot(document.getElementById('root')).render(screen==='admin'?<main className="p-4"><ServiceListings/></main>:screen==='cards'?<main className="grid gap-4 p-4 sm:grid-cols-2">{f.cards.map(s=><ServiceCard key={s.id} service={s}/>)}</main>:<Vendor/>));`;
const adapters = {
  'next/image': `import React from'react';export default function Image({fill,priority,unoptimized,sizes,...p}){return <img {...p} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:undefined}/>}`,
  '@/components/ui/LoadingLink': `import React from'react';export default function Link(p){return <a {...p}/>}`,
  '@/components/user/ServiceBookings': `import React from'react';export const ServiceBookings=()=> <p>Booking fixture</p>;`,
};
const built = await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: root }, bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /.*/ }, a => a.path in adapters ? { path: a.path, namespace: 'fixture' } : undefined);
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: adapters[a.path], loader: 'tsx', resolveDir: root }));
} }] });
const css = (await postcss([tailwind(loadConfig(path.join(root, 'tailwind.config.ts')))]).process(fs.readFileSync('app/globals.css', 'utf8'), { from: path.join(root, 'app/globals.css') })).css;
const png = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#005055' } }).png().toBuffer();
const catalog = [{ id: 'catalog-image', name: 'Image fixture service', category: 'Fixture category', description: 'Fixture description', defaultPrice: '2500', priceType: 'STARTING_FROM', active: true, imageUrl: null }];
const coverage = [{ city: { id: 'osm:n:1', name: 'Lahore', label: 'Lahore', kind: 'city', token: 'fixture', proof: { version: 2, providerId: 'fixture', sourceId: 'osm:n:1', boundaryIds: ['osm:r:1'], cityNames: ['lahore'], method: 'source-hierarchy' } }, entireCity: true, areas: [] }];
const listing = { id: 'listing-image', catalogId: catalog[0].id, name: catalog[0].name, type: catalog[0].category, description: catalog[0].description, price: '3100', priceType: 'STARTING_FROM', coverage, cities: ['Lahore'], durationMinutes: 60, leadDays: 1, warranty: '', cancellationTerms: 'Fixture cancellation terms', active: true, updatedAt: new Date().toISOString(), submittedAt: new Date().toISOString(), moderationStatus: 'APPROVED', imageUrl: null, vendor: { id: 'vendor-image', shopName: 'Fixture provider', status: 'approved' } };
const assets = new Map(); let failUpload = false, sequence = 0;
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture');
  if (url.pathname === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(built.outputFiles[0].contents); }
  if (url.pathname.startsWith('/uploads/')) { const image = assets.get(url.pathname); if (!image) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', 'image/png'); return res.end(image); }
  if (url.pathname === '/fixture') return json(res, { cards: [{ ...listing, id: 'own', imageUrl: listing.imageUrl, catalog: catalog[0] }, { ...listing, id: 'default', imageUrl: null, catalog: catalog[0] }, { ...listing, id: 'placeholder', imageUrl: null, catalog: null }] });
  let body = ''; for await (const chunk of req) body += chunk;
  if (url.pathname.endsWith('/services/image')) {
    if (failUpload) return json(res, { error: 'Fixture upload unavailable.' }, 503);
    const owner = url.pathname.includes('/admin/') ? url.searchParams.get('kind') === 'listing' ? 'vendor-vendor-image' : 'catalog' : 'vendor-vendor-image';
    const image = `/uploads/services/${owner}/svc-${++sequence}-12345678-1234-1234-1234-123456789abc.png`;
    assets.set(image, png); return json(res, { id: String(sequence), url: image });
  }
  if (url.pathname === '/api/admin/services/catalog') { Object.assign(catalog[0], JSON.parse(body)); return json(res, { catalog: catalog[0] }); }
  if (url.pathname === '/api/vendor/services') {
    if (req.method === 'POST') { Object.assign(listing, JSON.parse(body), { moderationStatus: 'PENDING_APPROVAL' }); return json(res, { service: listing }); }
    return json(res, { services: [{ ...listing, catalog: catalog[0] }], catalog: catalog.filter(c => c.active), products: [], addons: [], bookingCount: 0 });
  }
  if (url.pathname === '/api/admin/services') return json(res, { services: [{ ...listing, catalog: catalog[0] }], catalog, vendors: [{ id: 'vendor-image', shopName: 'Fixture provider', city: 'Lahore' }], total: 1, stats: [], locationRequests: [] });
  res.setHeader('Content-Type', 'text/html'); res.end(`<html><head><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const upload = label => page.getByLabel(label, { exact: true }).setInputFiles({ name: 'service.png', mimeType: 'image/png', buffer: png });
  const openCatalog = async () => { await page.getByRole('button', { name: 'Service Catalog', exact: true }).click(); await page.getByRole('button', { name: 'Edit / enable / disable', exact: true }).click(); };
  await page.goto(base + '/?screen=admin'); await openCatalog();
  await upload('Default service image'); await page.getByText('Image uploaded. Save the service to apply it.', { exact: true }).waitFor();
  const first = [...assets.keys()].at(-1);
  assert.equal(await page.locator('fieldset img').getAttribute('src'), first);
  failUpload = true; await upload('Default service image'); await page.getByRole('alert').filter({ hasText: 'Fixture upload unavailable' }).waitFor();
  assert.equal(await page.locator('fieldset img').getAttribute('src'), first); failUpload = false;
  await upload('Default service image'); await page.getByText('Image uploaded. Save the service to apply it.', { exact: true }).waitFor();
  const defaultImage = [...assets.keys()].at(-1); assert.notEqual(defaultImage, first);
  await page.getByRole('button', { name: 'Save catalog service', exact: true }).click(); await page.locator('fieldset[aria-busy]').waitFor({ state: 'detached' });
  assert.equal(catalog[0].imageUrl, defaultImage); assert.equal(catalog[0].defaultPrice, 2500);
  await page.reload(); await openCatalog(); assert.equal(await page.locator('fieldset img').getAttribute('src'), defaultImage);
  for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Admin overflow ${width}`); }
  await page.getByRole('button', { name: 'Remove image', exact: true }).click(); await page.getByRole('button', { name: 'Save catalog service', exact: true }).click(); await page.locator('fieldset[aria-busy]').waitFor({ state: 'detached' });
  assert.equal(catalog[0].imageUrl, null); assert.ok(assets.has(defaultImage));
  // Restore through the same image UI for the vendor fallback test.
  await openCatalog(); await upload('Default service image'); await page.getByText('Image uploaded. Save the service to apply it.', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Save catalog service', exact: true }).click(); await page.locator('fieldset[aria-busy]').waitFor({ state: 'detached' });
  await page.goto(base + '/?screen=vendor'); await page.getByRole('button', { name: 'Edit & resubmit', exact: true }).click();
  assert.equal(await page.locator('fieldset img').getAttribute('src'), catalog[0].imageUrl);
  await upload('Service listing image'); await page.getByText('Image uploaded. Save the service to apply it.', { exact: true }).waitFor();
  const own = [...assets.keys()].at(-1);
  await page.getByRole('button', { name: 'Submit for Approval', exact: true }).click(); await page.getByText('Submitted. Pending Admin Approval; hidden until reviewed.', { exact: true }).waitFor();
  assert.equal(listing.imageUrl, own); assert.equal(listing.price, 3100); assert.equal(listing.moderationStatus, 'PENDING_APPROVAL'); assert.deepEqual(listing.coverage, coverage);
  await page.reload(); await page.getByRole('button', { name: 'Edit & resubmit', exact: true }).click(); assert.equal(await page.locator('fieldset img').getAttribute('src'), own);
  await page.getByRole('button', { name: 'Remove image', exact: true }).click(); assert.equal(await page.locator('fieldset img').getAttribute('src'), catalog[0].imageUrl);
  for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Vendor overflow ${width}`); }
  await page.getByRole('button', { name: 'Submit for Approval', exact: true }).click(); await page.locator('fieldset[aria-busy]').waitFor({ state: 'detached' }); assert.equal(listing.imageUrl, null); assert.ok(assets.has(own));
  listing.imageUrl = own;
  await page.goto(base + '/?screen=cards'); await page.locator('article').first().waitFor();
  assert.equal(await page.locator('article').nth(0).locator('img').getAttribute('src'), own);
  assert.equal(await page.locator('article').nth(1).locator('img').getAttribute('src'), catalog[0].imageUrl);
  assert.equal(await page.locator('article').nth(2).getByRole('img').getAttribute('aria-label'), listing.name + ' — image unavailable');
  assets.delete(own); await page.reload();
  await page.waitForFunction(expected => document.querySelector('article img')?.getAttribute('src') === expected, catalog[0].imageUrl);
  assets.set(own, png);
  listing.imageUrl = null; catalog[0].active = false;
  await page.goto(base + '/?screen=vendor'); await page.getByRole('button', { name: 'Edit & resubmit', exact: true }).click();
  assert.equal(await page.locator('fieldset img').getAttribute('src'), catalog[0].imageUrl, 'existing inactive catalog default remains visible');
  assert.deepEqual(errors, []);
  console.log('PASS admin upload/preview/failure/replace/remove/reload; vendor override/default/remove/moderation; cards/placeholder; 320–1440px layouts. Offline fixtures only.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
