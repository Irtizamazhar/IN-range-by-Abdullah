// Exercises the real dashboard chrome/sidebar components and generated app CSS.
// Only Next routing, image optimization, authentication and API responses are stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');

async function main() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-scroll-'));
  const css = await require('postcss')([require('tailwindcss')('./tailwind.config.ts'), require('autoprefixer')])
    .process(fs.readFileSync('app/globals.css', 'utf8'), { from: 'app/globals.css' });
  const stubs = {
    'next/navigation': 'export const usePathname=()=>window.testPath;',
    'next/link': 'import React from "react"; export default function Link(p){return React.createElement("a",p)}',
    'next/image': 'import React from "react"; export default function Image({priority,fill,unoptimized,...p}){return React.createElement("img",p)}',
    'next-auth/react': 'export const signOut=()=>{};',
  };
  const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {AdminChrome} from './app/admin/AdminChrome'; import {VendorChrome} from './components/vendor/VendorChrome'; const root=createRoot(document.getElementById('root')); window.mount=(role)=>{window.testPath='/'+role+'/dashboard';const C=role==='admin'?AdminChrome:VendorChrome;root.render(<C shopName="Demo Store"><div style={{height:2400,padding:24}}>Dashboard content</div></C>);};`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'next-fixtures', setup(b) { b.onResolve({ filter: /^next\/(navigation|link|image)$|^next-auth\/react$/ }, a => ({ path: a.path, namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: stubs[a.path], resolveDir: process.cwd() })); } }] });
  const browser = await chromium.launch({ executablePath: process.env.ACCOUNT_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const role of ['admin', 'vendor']) {
      for (const [name, width, height, scale] of [['desktop',1440,900,1],['short',1280,400,1],['zoom-200-equivalent',960,450,2],['mobile',390,664,1],['mobile-short',320,400,1],['landscape',667,320,1]]) {
        const mobile = width < 768;
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, hasTouch: mobile });
        const page = await context.newPage();
        await page.route('https://dashboard.test/**', route => {
          const url = route.request().url();
          if (url.endsWith('/logo.png')) return route.fulfill({ contentType: 'image/png', body: fs.readFileSync('public/logo.png') });
          if (url.includes('/api/')) return route.fulfill({ json: {} });
          return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
        });
        await page.goto('https://dashboard.test');
        await page.addStyleTag({ content: css.css });
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page.evaluate(role => window.mount(role), role);
        const nav = page.getByRole('navigation');
        if (mobile) {
          await page.getByRole('button', { name: `Open ${role} menu`, exact: false }).click();
          assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
          assert.equal(await page.locator('[inert]').count(), 1);
        }
        await nav.waitFor();
        const dimensions = await nav.evaluate(n => {
          const s = getComputedStyle(n), a = n.closest('aside'), r = a.getBoundingClientRect();
          return { overflow: s.overflowY, overscroll: s.overscrollBehaviorY, scrollbar: s.scrollbarWidth, horizontal: n.scrollWidth > n.clientWidth, bottom: r.bottom, height: n.clientHeight, asideScroll: a.scrollHeight > a.clientHeight };
        });
        assert.equal(dimensions.overflow, 'auto'); assert.equal(dimensions.overscroll, 'contain');
        assert.equal(dimensions.scrollbar, 'thin'); assert.equal(dimensions.horizontal, false);
        assert.equal(dimensions.asideScroll, false); assert.ok(dimensions.bottom <= height + 1); assert.ok(dimensions.height > 0);
        const logout = page.getByRole('button', { name: /log\s*out/i });
        const logoutBox = await logout.boundingBox(); assert.ok(logoutBox.y + logoutBox.height <= height);
        // Native keyboard scrolling and focus-driven reveal of lower links.
        await nav.focus(); await page.keyboard.press('End');
        await page.waitForTimeout(200);
        for (const label of ['Settings', role === 'admin' ? 'Support' : 'Help & Support']) {
          const link = nav.getByRole('link', { name: label, exact: true });
          await link.focus();
          const box = await link.boundingBox(), bounds = await nav.boundingBox();
          assert.ok(box.y >= bounds.y - 1 && box.y + box.height <= bounds.y + bounds.height + 1, label + ' clipped');
        }
        const navBox = await nav.boundingBox();
        await nav.evaluate(n => { n.scrollTop = 0; });
        await page.mouse.move(navBox.x + 100, navBox.y + navBox.height / 2);
        await page.mouse.wheel(0, 450); await page.waitForTimeout(200);
        assert.ok(await nav.evaluate(n => n.scrollHeight <= n.clientHeight || n.scrollTop > 0), 'wheel scroll');
        await nav.evaluate(n => { n.scrollTop = n.scrollHeight; });
        await page.mouse.wheel(0, 800); await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => document.querySelector('#dashboard-sidebar').nextElementSibling.scrollTop), 0, 'scroll chaining');
        if (mobile) {
          const cdp = await context.newCDPSession(page);
          await nav.evaluate(n => { n.scrollTop = 0; });
          const x = navBox.x + 100, y = navBox.y + navBox.height - 8;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
          for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * Math.min(20, navBox.height / 8) }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForTimeout(200);
          assert.ok(await nav.evaluate(n => n.scrollTop > 0), 'touch scroll');
        }
        await nav.evaluate(n => { n.scrollTop = n.scrollHeight; });
        await page.screenshot({ path: path.join(out, role + '-' + name + '.png') });
        if (mobile) {
          await logout.focus(); await page.keyboard.press('Tab');
          assert.equal(await page.getByRole('button', { name: 'Close menu' }).evaluate(b => b === document.activeElement), true);
          await page.keyboard.press('Escape');
          await page.getByRole('dialog').waitFor({ state: 'hidden' });
          assert.equal(await page.evaluate(() => document.body.style.overflow), '');
          assert.equal(await page.locator('[inert]').count(), 0);
          // Resizing an open drawer to desktop must release the lock too.
          await page.getByRole('button', { name: `Open ${role} menu`, exact: false }).click();
          await page.setViewportSize({ width: 1024, height: 600 });
          await page.waitForFunction(() => document.body.style.overflow !== 'hidden');
        }
        console.log('PASS', role, name);
        await context.close();
      }
    }
    console.log('SCREENSHOTS=' + out);
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
