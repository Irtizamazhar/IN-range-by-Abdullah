// Real checkout UI; isolated session/cart adapters and HTTP fixtures. No production requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {Toaster} from 'react-hot-toast';import Checkout from './app/(user)/checkout/page';createRoot(document.getElementById('root')).render(<><Checkout/><Toaster/></>);`;
const modules = {
  'next-auth/react': `const session={user:{id:'customer-a',role:'customer',name:'Ali Khan',email:'owner@example.invalid',phone:'03001234567'}};export const useSession=()=>({data:session,status:'authenticated'});export const getSession=async()=>window.__expired?null:session;`,
  '@/context/CustomerAuthContext': `export const useCustomerAuth=()=>({isCustomer:true,authLoading:false,openAuthModal:()=>{window.__authOpens=(window.__authOpens||0)+1}});`,
  '@/context/CartContext': `import {useState} from 'react';const initial=[{productId:'cream',name:'cream',price:2000,quantity:1,image:'/logo.png'}];export function useCart(){const [items,setItems]=useState(initial);return{items,subtotal:items.length?2000:0,clear:()=>{window.__clears=(window.__clears||0)+1;setItems([])}}}`,
  '@/hooks/useLoadingRouter': `const router={push:()=>{},replace:async href=>{window.__navigation=href;window.__navigationCount=(window.__navigationCount||0)+1;}};export const useLoadingRouter=()=>router;`,
  '@/components/ui/LoadingLink': `import React from 'react';export default function Link(props){return <a {...props}/>}`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>}`,
};

async function run() {
  const built = await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: root }, bundle: true, write: false, outfile: 'ux.js', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'adapters', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in modules ? { path: args.path, namespace: 'adapter' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'adapter' }, args => ({ contents: modules[args.path], loader: 'tsx', resolveDir: root }));
  } }] });
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  const styles = await postcss([tailwind({ ...config, content: [...config.content, { raw: entry, extension: 'tsx' }] })]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
  const js = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = styles.css + '\n' + (built.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
  const server = http.createServer((req, res) => {
    if (req.url === '/ux.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(js); }
    else if (req.url === '/ux.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else if (req.url === '/logo.png') { res.setHeader('Content-Type', 'image/png'); res.end(fs.readFileSync(path.join(root, 'public/logo.png'))); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ux.css"></head><body><div id="root"></div><script src="/ux.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file => fs.existsSync(file));
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    for (const width of [320, 375, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [], posts = []; let mode = 'empty';
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/api/settings') return route.fulfill({ json: { codAvailableCities: ['Lahore'], codCharges: 100, whatsappNumber: '' } });
        if (url.pathname === '/api/checkout/handling-fee') return route.fulfill({ json: { handlingFee: 200 } });
        if (url.pathname === '/api/orders') {
          posts.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
          if (mode === 'network') return route.abort('failed');
          if (mode === 'empty') return route.fulfill({ status: 200, body: '' });
          if (mode === 'error') return route.fulfill({ status: 503, headers: { 'X-Request-ID': 'safe-reference' }, json: { error: 'PRIVATE SQL recipientKey' } });
          await new Promise(resolve => setTimeout(resolve, 200));
          return route.fulfill({ json: { _id: 'order-1', orderNumber: 'IRB-001', customerPhone: '03001234567' } });
        }
        return route.fulfill({ json: {} });
      });
      async function fill() {
        await page.getByRole('heading', { name: 'Secure Checkout', exact: true }).waitFor();
        await page.getByRole('textbox', { name: 'Street address', exact: true }).fill('12 Street');
        const city = page.getByRole('combobox', { name: 'Delivery city', exact: true });
        await city.fill('Lahore'); await city.press('Tab');
      }
      const complete = page.getByRole('button', { name: 'Place Order', exact: true });
      await page.goto(base + '/checkout'); await fill();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.evaluate(() => window.__expired = true); await complete.click();
      await page.waitForFunction(() => window.__authOpens === 1); assert.equal(posts.length, 0);
      await page.evaluate(() => window.__expired = false); await complete.click();
      await page.getByText(/We could not confirm your order/).first().waitFor();
      assert.equal(await page.evaluate(() => window.__clears || 0), 0); assert.equal(posts.length, 1);
      const retryKey = posts[0].key;
      mode = 'network'; await page.reload(); await fill(); await complete.click();
      await page.getByText(/Connection interrupted/).first().waitFor();
      assert.equal(posts[1].key, retryKey); assert.equal(await page.evaluate(() => window.__clears || 0), 0);
      mode = 'error'; await complete.click(); await page.getByText(/safe-reference/).first().waitFor();
      assert.equal(await page.getByText(/PRIVATE SQL/).count(), 0); assert.equal(posts[2].key, retryKey);
      await page.getByLabel('Use a different billing address').check();
      await page.getByRole('textbox', { name: 'Billing first name', exact: true }).fill('Company');
      await page.getByRole('textbox', { name: 'Billing street address', exact: true }).fill('20 Billing Street');
      const billingCity = page.getByRole('combobox', { name: 'Billing city', exact: true });
      await billingCity.fill('Karachi'); await billingCity.press('Tab');
      mode = 'success'; const before = posts.length;
      await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await page.getByText('IRB-001', { exact: true }).waitFor();
      assert.equal(posts.length, before + 1); assert.equal(posts.at(-1).key, retryKey);
      assert.equal(posts.at(-1).body.sameBillingAddress, false); assert.equal(posts.at(-1).body.billingAddress.address, '20 Billing Street');
      assert.equal(await page.evaluate(() => window.__clears), 1);
      await page.getByRole('dialog', { name: 'Order confirmed!', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__navigation), '/account/orders/order-1');
      assert.equal(await page.evaluate(() => window.__navigationCount), 1);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: session expiry, failure handling, retry key, billing, double-submit lock, confirmation popup, order-details redirect and one cart clear`);
      await page.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
