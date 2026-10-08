/** Real React feed browser checks. Every API request is intercepted; no database is touched. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');

async function main() {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React, {StrictMode, useEffect, useSyncExternalStore} from 'react';
      import {createRoot} from 'react-dom/client';
      import {Toaster} from 'react-hot-toast';
      import {WantsFeed} from './app/(user)/wants/WantsFeed';
      const listeners=new Set();
      const notify=()=>listeners.forEach(listener=>listener());
      ['pushState','replaceState'].forEach(method=>{const original=history[method].bind(history);history[method]=(...args)=>{original(...args);notify();};});
      addEventListener('popstate',notify);
      window.testSession={data:null,status:'unauthenticated'};
      window.setTestSession=session=>{window.testSession=session;notify();};
      window.subscribeFeedFixture=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
      window.testNavigate=href=>{window.feedScrollBeforeDetails=scrollY;history.pushState(null,'',href);};
      function Details(){useEffect(()=>{window.scrollTo(0,0);},[]);return <main><h1>Want details fixture</h1><button onClick={()=>history.back()}>Back to feed</button></main>;}
      function App(){const route=useSyncExternalStore(window.subscribeFeedFixture,()=>location.pathname);return <><Toaster/>{route.startsWith('/wants/')?<Details/>:<WantsFeed categories={['Furniture','Electronics','Other']}/>}</>;}
      createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
    ` },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic', outfile: 'wants-fixture.js',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'feed-fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/(navigation|link|image)$|^next-auth\/react$|components\/user\/PostWantButton$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
        if (args.path === 'next/navigation') return { contents: `import {useMemo,useSyncExternalStore} from 'react';const router={push:href=>window.testNavigate(href),replace:href=>history.replaceState(null,'',href),refresh:()=>{},back:()=>history.back(),forward:()=>history.forward(),prefetch:()=>{}};export const useRouter=()=>router;export function useSearchParams(){const query=useSyncExternalStore(window.subscribeFeedFixture,()=>location.search);return useMemo(()=>new URLSearchParams(query),[query]);}`, loader: 'js', resolveDir: process.cwd() };
        if (args.path === 'next-auth/react') return { contents: `import {useSyncExternalStore} from 'react';export function useSession(){return useSyncExternalStore(window.subscribeFeedFixture,()=>window.testSession);}`, loader: 'js', resolveDir: process.cwd() };
        if (args.path === 'next/link') return { contents: `import React from 'react';export default React.forwardRef(function Link({children,href,prefetch,replace,scroll,...props},ref){return <a {...props} href={href} ref={ref}>{children}</a>;});`, loader: 'jsx', resolveDir: process.cwd() };
        if (args.path === 'next/image') return { contents: `import React from 'react';export default function Image({fill,unoptimized,priority,loading='lazy',...props}){return <img {...props} loading={loading}/>;}`, loader: 'jsx', resolveDir: process.cwd() };
        return { contents: `import React from 'react';export function PostWantButton({children,...props}){return <button {...props} onClick={()=>{window.postWantOpened=true;}}> {children}</button>;}`, loader: 'jsx', resolveDir: process.cwd() };
      });
    } }],
  });
  const script = result.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = result.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [], consoleErrors = [], requests = [], gates = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const output = path.join(process.cwd(), 'coverage', 'wants-feed'); fs.mkdirSync(output, { recursive: true });
  function post(id, extra = {}) {
    return { id, title: `Requirement ${id}`, description: 'Looking for a dependable item in good condition. Please share matching options and delivery availability.', images: [], photo: null, budgetMin: '1000', budgetMax: '5000', budgetFlexible: false, quantity: 2, category: 'Furniture', city: 'Lahore', status: 'OPEN', createdAt: '2026-10-08T08:00:00.000Z', expiresAt: '2099-11-08T08:00:00.000Z', customer: { name: 'Ayesha Khan', image: null }, ...extra };
  }
  const response = (wants, nextCursor = null) => ({ wants, nextCursor, hasMore: nextCursor !== null });
  try {
    await page.route('http://wants.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: script });
      if (url.pathname === '/test-photo.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#e9f3d1"/><rect x="260" y="70" width="280" height="330" rx="35" fill="#244d35"/><text x="400" y="450" text-anchor="middle" fill="#244d35" font-size="30">Reference item</text></svg>' });
      if (url.pathname === '/api/wants/feed') { requests.push(url); gates.push({ url, route }); return; }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 500, json: { error: 'Unexpected fixture API' } });
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}h1,h2,p,dl,dd{margin:0}button,input,select{font:inherit}button{border:0;cursor:pointer}a{color:inherit;text-decoration:none}svg{width:20px;height:20px}button:disabled{cursor:wait}main{padding:30px}${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>` });
    });
    async function release(predicate, body, status = 200) {
      await eventually(() => assert.ok(gates.some(gate => predicate(gate.url)), 'expected feed request was sent'));
      const matching = gates.filter(gate => predicate(gate.url));
      for (const gate of matching) { gates.splice(gates.indexOf(gate), 1); await gate.route.fulfill({ status, json: body }).catch(() => {}); }
    }
    const initialQuery = url => url.searchParams.get('tab') === 'all' && !url.searchParams.get('city') && !url.searchParams.get('cursor');
    await page.goto('http://wants.test/wants');
    await page.getByRole('heading', { name: 'Discover what people need' }).waitFor();
    await page.getByRole('status', { name: 'Loading Wants…', exact: true }).waitFor();
    await release(initialQuery, { error: 'Feed unavailable. Please retry.' }, 503);
    await page.getByRole('alert').filter({ hasText: 'Feed unavailable' }).waitFor();
    const retry = page.getByRole('button', { name: 'Try again', exact: true });
    await retry.click();
    await eventually(async () => assert.equal(await page.locator('button[data-loading="true"]').count(), 1));
    await page.getByRole('alert').filter({ hasText: 'Feed unavailable' }).waitFor();
    const batch = Array.from({ length: 10 }, (_, i) => post(`item-${i + 1}`, i === 1 ? { images: ['/test-photo.svg'], photo: '/test-photo.svg' } : {}));
    await release(initialQuery, response(batch, 'page-two'));
    await eventually(async () => assert.equal(await page.locator('[data-want-post]').count(), 10));
    assert.equal(await page.locator('[data-want-post="item-1"] img').count(), 0, 'a text-only post has no empty image element');
    await page.locator('[data-want-post="item-2"] img').scrollIntoViewIfNeeded();
    await eventually(async () => assert.equal(await page.locator('[data-want-post="item-2"] img').evaluate(image => image.complete && image.naturalWidth > 0), true));
    assert.ok((await page.locator('[data-want-post="item-2"] img').boundingBox()).height > 100);
    console.log('PASS feed initial skeleton, server failure, retained retry button, successful content, text-only and image cards');

    const more = page.getByRole('button', { name: 'Load more Wants', exact: true });
    await more.scrollIntoViewIfNeeded();
    await page.getByRole('status', { name: 'Loading more Wants…', exact: true }).waitFor();
    const pageTwo = url => url.searchParams.get('cursor') === 'page-two';
    await eventually(() => assert.equal(requests.filter(pageTwo).length, 1));
    await page.locator('button[data-loading="true"]').last().evaluate(button => { button.click(); button.click(); });
    assert.equal(requests.filter(pageTwo).length, 1, 'observer/click overlaps cannot duplicate next-page requests');
    await release(pageTwo, { error: 'Next page failed' }, 500);
    await page.getByRole('alert').filter({ hasText: 'Next page failed' }).waitFor();
    assert.equal(await page.locator('[data-want-post]').count(), 10);
    await page.getByRole('button', { name: 'Retry loading more', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Next page failed' }).waitFor();
    await page.locator('button[data-loading="true"]').waitFor();
    await release(pageTwo, response([post('item-10'), post('item-11')]));
    await eventually(async () => assert.equal(await page.locator('[data-want-post]').count(), 11));
    await page.getByText('You’re all caught up', { exact: true }).waitFor();
    assert.equal(requests.filter(pageTwo).length, 2);
    console.log('PASS infinite scrolling, no overlapping requests/duplicate posts, next-page failure, retry same cursor, end state');

    await page.locator('[data-want-post="item-8"]').getByRole('link', { name: 'View details' }).click();
    await page.getByRole('heading', { name: 'Want details fixture' }).waitFor();
    const savedScroll = await page.evaluate(() => window.feedScrollBeforeDetails);
    const beforeReturn = requests.length;
    await page.getByRole('button', { name: 'Back to feed' }).click();
    await eventually(async () => assert.equal(await page.locator('[data-want-post]').count(), 11));
    await eventually(async () => assert.ok(Math.abs((await page.evaluate(() => scrollY)) - savedScroll) <= 3, 'saved scroll position restored'));
    assert.equal(requests.length, beforeReturn, 'returning from details restores loaded pages without refetching');
    console.log('PASS detail return restores loaded posts and scroll under React StrictMode');

    await page.getByRole('button', { name: 'Nearby', exact: true }).click();
    await page.getByRole('heading', { name: 'Find needs close to you' }).waitFor();
    await page.getByRole('button', { name: 'Choose a city', exact: true }).click();
    await eventually(async () => assert.equal(await page.getByLabel('Filter by city').evaluate(input => input === document.activeElement), true));
    await page.getByLabel('Filter by city').fill('Taxila');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await release(url => url.searchParams.get('tab') === 'nearby' && url.searchParams.get('city') === 'Taxila', response([post('taxila', { city: 'Taxila' })]));
    await page.locator('[data-want-post="taxila"]').waitFor();
    assert.match(page.url(), /city=Taxila/);
    await page.getByRole('button', { name: 'My Wants', exact: true }).click();
    await page.getByRole('heading', { name: 'Your Wants, all in one place' }).waitFor();
    assert.equal(await page.locator('[data-want-post]').count(), 0);
    await page.evaluate(() => window.setTestSession({ status: 'authenticated', data: { user: { id: 'customer-a', role: 'customer' } } }));
    await release(url => url.searchParams.get('tab') === 'mine', response([post('private-a', { status: 'PENDING_MODERATION' })]));
    await page.locator('[data-want-post="private-a"]').waitFor();
    await page.getByText('Pending review', { exact: true }).waitFor();
    await page.evaluate(() => window.setTestSession({ status: 'authenticated', data: { user: { id: 'customer-b', role: 'customer' } } }));
    await eventually(async () => assert.equal(await page.locator('[data-want-post="private-a"]').count(), 0));
    await release(url => url.searchParams.get('tab') === 'mine', response([post('private-b')]));
    await page.locator('[data-want-post="private-b"]').waitFor();
    await page.evaluate(() => window.setTestSession({ status: 'unauthenticated', data: null }));
    await page.getByRole('heading', { name: 'Your Wants, all in one place' }).waitFor();
    assert.equal(await page.locator('[data-want-post]').count(), 0);
    console.log('PASS tabs, city filtering, sign-in state, and old-account posts hidden on account changes/logout');

    await page.getByRole('button', { name: 'All Wants', exact: true }).click();
    await release(url => url.searchParams.get('tab') === 'all' && url.searchParams.get('city') === 'Taxila', response([post('responsive-text'), post('responsive-image', { images: ['/test-photo.svg'], photo: '/test-photo.svg' })]));
    await page.locator('[data-want-post="responsive-text"]').waitFor();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => scrollTo(0, 0));
      await eventually(async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}px`));
      const box = await page.locator('[data-want-post="responsive-text"]').boundingBox();
      assert.ok(box.width <= Math.min(780, width));
      if (width < 640) assert.ok(box.width >= width - 25, 'mobile cards use available width');
      await page.screenshot({ path: path.join(output, `feed-${width}.png`), fullPage: true });
    }
    const beforeCachedFilter = requests.length;
    await page.evaluate(items => {
      sessionStorage.setItem('joro-wants-feed-v1:public:tab=all&city=Karachi', JSON.stringify({ items, nextCursor: null, hasMore: false, scrollY: 650, savedAt: Date.now(), resume: true }));
      window.scrollTo({ top: 0, behavior: 'instant' });
      history.pushState(null, '', '/wants?tab=all&city=Karachi');
    }, Array.from({ length: 10 }, (_, i) => post(`cached-${i}`, { city: 'Karachi' })));
    await page.locator('[data-want-post="cached-0"]').waitFor();
    await eventually(async () => assert.ok(Math.abs((await page.evaluate(() => scrollY)) - 650) <= 3, 'cached filter selection restores its saved scroll without unmounting the feed'));
    assert.equal(requests.length, beforeCachedFilter);
    console.log('PASS cached filter restoration while the existing feed stays mounted');
    await page.getByRole('button', { name: 'Post a Want', exact: true }).first().click();
    assert.equal(await page.evaluate(() => window.postWantOpened), true);
    assert.deepEqual(browserErrors, []);
    console.log('PASS 320/390/1440 responsive widths, posting action connection, no browser runtime errors');
    console.log(`Screenshots: ${output}`);
  } catch (error) {
    console.error('Failure state:', page.url(), browserErrors, consoleErrors, (await page.locator('body').innerText()).slice(0, 2500));
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    throw error;
  } finally { await browser.close(); }
}

async function eventually(check) {
  const deadline = Date.now() + 10000; let error;
  while (Date.now() < deadline) { try { await check(); return; } catch (cause) { error = cause; } await new Promise(resolve => setTimeout(resolve, 25)); }
  throw error;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
