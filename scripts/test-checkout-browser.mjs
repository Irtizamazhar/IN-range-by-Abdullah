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
  'next-auth/react': `import {useState,useEffect} from 'react';const initial={user:{id:'customer-a',role:'customer',name:'Ali Khan',email:'owner@example.invalid',phone:'03001234567'}};export function useSession(){const [session,setSession]=useState(window.__session===undefined?initial:window.__session);useEffect(()=>{const update=()=>setSession(window.__session);window.addEventListener('test-session',update);return()=>window.removeEventListener('test-session',update)},[]);return {data:session,status:session?'authenticated':'unauthenticated'}};export const getSession=async()=>window.__expired?null:window.__session===undefined?initial:window.__session;`,
  '@/context/CustomerAuthContext': `import {useSession} from 'next-auth/react';export const useCustomerAuth=()=>{const {data}=useSession();return {isCustomer:data?.user?.role==='customer',authLoading:false,openAuthModal:()=>{window.__authOpens=(window.__authOpens||0)+1}}};`,
  '@/context/CartContext': `import {useState} from 'react';const initial=[{productId:'cream',name:'cream',price:2000,quantity:1,image:'/logo.png'}];export function useCart(){const [items,setItems]=useState(window.__cart||initial);return{items,subtotal:items.reduce((sum,i)=>sum+(i.price+(i.servicePrice||0))*i.quantity,0),clear:()=>{window.__clears=(window.__clears||0)+1;setItems([])}}}`,
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
    for (const width of [375, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      let saved = { recipientName: 'Saved Customer', phone: '+923001234567', address: 'Saved delivery street, Area 2', city: 'Lahore', postalCode: '54000', isDefault: true };
      let posts = [], saves = 0, failSave = false, delayAddress = false;
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/api/settings') return route.fulfill({ json: { codAvailableCities: ['Lahore'], codCharges: 100 } });
        if (url.pathname === '/api/customer/profile') return route.fulfill({ json: { name: 'Registered Name', email: 'owner@example.invalid', phone: '03001234567' } });
        if (url.pathname === '/api/customer/addresses') {
          if (request.method() === 'GET') { if (delayAddress) await new Promise(resolve => setTimeout(resolve, 700)); return route.fulfill({ json: { addresses: [saved] } }); }
          saves++; assert.deepEqual(request.postDataJSON(), { orderId: 'address-order' });
          if (failSave) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
          const order = posts.at(-1); saved = { ...saved, recipientName: order.customerName, phone: order.customerPhone, address: order.customerAddress, city: order.city, postalCode: order.postalCode };
          return route.fulfill({ json: { saved: true } });
        }
        if (url.pathname === '/api/checkout/handling-fee') return route.fulfill({ json: { handlingFee: 0 } });
        if (url.pathname === '/api/orders') { posts.push(request.postDataJSON()); return route.fulfill({ json: { _id: 'address-order', orderNumber: 'ADDRESS-001', totalAmount: 2100 } }); }
        return route.fulfill({ json: {} });
      });
      await page.goto(base + '/checkout');
      const street = page.getByRole('textbox', { name: 'Street address', exact: true });
      await page.waitForFunction(() => document.getElementById('checkout-address')?.value === 'Saved delivery street, Area 2');
      assert.equal(await page.locator('#checkout-firstName').inputValue(), 'Saved');
      assert.equal(await page.locator('#checkout-lastName').inputValue(), 'Customer');
      assert.equal(await page.locator('#checkout-email').inputValue(), 'owner@example.invalid');
      await street.fill('New saved delivery');
      await page.getByText('Save this information for next time', { exact: true }).click();
      await page.getByRole('button', { name: 'Place Order', exact: true }).click();
      await page.getByText('ADDRESS-001', { exact: true }).waitFor();
      assert.equal(saves, 1); assert.equal(saved.address, 'New saved delivery');
      await page.reload();
      await page.waitForFunction(() => document.getElementById('checkout-address')?.value === 'New saved delivery');
      await street.fill('One time delivery');
      await page.getByRole('button', { name: 'Place Order', exact: true }).click();
      await page.getByText('ADDRESS-001', { exact: true }).waitFor();
      assert.equal(saves, 1); assert.equal(saved.address, 'New saved delivery');
      failSave = true; await page.reload();
      await page.waitForFunction(() => document.getElementById('checkout-address')?.value === 'New saved delivery');
      await page.getByText('Save this information for next time', { exact: true }).click();
      await page.getByRole('button', { name: 'Place Order', exact: true }).click();
      await page.getByText(/Your order is confirmed, but your address could not be saved/).waitFor();
      assert.equal(await page.getByRole('dialog').isVisible(), true);
      delayAddress = true; await page.reload();
      await street.fill('Typing before saved response');
      await page.waitForFunction(() => !document.body.textContent.includes('Loading your saved information...'));
      assert.equal(await street.inputValue(), 'Typing before saved response');
      await page.evaluate(() => { window.__session = null; window.dispatchEvent(new Event('test-session')); });
      await page.getByText('An account is required to check out').waitFor();
      saved = { ...saved, recipientName: 'Customer B', address: 'Customer B street' };
      await page.evaluate(() => { window.__session = { user: { id: 'customer-b', role: 'customer', name: 'Customer B', email: 'b@example.invalid' } }; window.dispatchEvent(new Event('test-session')); });
      await page.waitForFunction(() => document.getElementById('checkout-address')?.value === 'Customer B street');
      assert.equal(await street.inputValue(), 'Customer B street');
      console.log(`PASS ${width}px: saved-address prefill, checked save, next-checkout persistence, unchecked preservation, optional-save failure, typing race and account switch`);
      await page.close();
    }
    for (const requestType of ['SERVICE', 'GIFT']) {
      const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
      const shipping = requestType === 'SERVICE' ? 0 : 75, city = requestType === 'SERVICE' ? 'Karachi' : 'Lahore';
      await page.addInitScript(() => { window.__cart = [{ productId: 'quote:quote-1', name: 'Accepted offer', price: 1, quantity: 2, image: '/logo.png', quoteId: 'quote-1', quoteShipping: 999 }]; });
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/settings') return route.fulfill({ json: { codAvailableCities: ['Lahore'], codCharges: 100 } });
        if (url.pathname === '/api/customer/profile') return route.fulfill({ json: {} });
        if (url.pathname === '/api/customer/addresses') return route.fulfill({ json: { addresses: [{ isDefault: true, recipientName: 'Ali Khan', phone: '03001234567', address: '12 Delivery street', city }] } });
        if (url.pathname === '/api/checkout/handling-fee') return route.fulfill({ json: { handlingFee: 0, quotePricing: { subtotal: 3600, shipping, requestType, city } } });
        if (url.pathname === '/api/orders') {
          const body = route.request().postDataJSON(); assert.equal(body.expectedSubtotal, 3600); assert.equal(body.expectedDeliveryCharge, shipping); assert.equal(body.quoteId, 'quote-1');
          return route.fulfill({ json: { _id: 'quote-order', orderNumber: 'QUOTE-001', totalAmount: 3600 + shipping } });
        }
        return route.fulfill({ json: {} });
      });
      await page.goto(base + '/checkout');
      await page.waitForFunction(() => document.getElementById('checkout-address')?.value === '12 Delivery street');
      await page.getByRole('button', { name: 'Place Order', exact: true }).click();
      await page.getByText('QUOTE-001', { exact: true }).waitFor();
      assert.match(await page.getByRole('dialog').innerText(), requestType === 'SERVICE' ? /3,600/ : /3,675/);
      console.log(`PASS ${requestType}: authoritative agreed subtotal/shipping, service city, and confirmed total`);
      await page.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
