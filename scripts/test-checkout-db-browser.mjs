/** Real React checkout against the disposable-MySQL route bridge supplied by the DB suite. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';

export async function runDatabaseCheckoutBrowser(bridge) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const modules = {
    'next-auth/react': `const session={user:{id:'customer-a',role:'customer',name:'Checkout Test A',email:'a@example.invalid',phone:'03001234567'}};export const useSession=()=>({data:session,status:'authenticated'});export const getSession=async()=>session;`,
    '@/context/CustomerAuthContext': `export const useCustomerAuth=()=>({isCustomer:true,authLoading:false,openAuthModal:()=>{}});`,
    '@/context/CartContext': `import {useState} from 'react';export function useCart(){const[items,setItems]=useState([{productId:'cream',name:'Fixture product',price:2000,quantity:1,image:'/logo.png',maxStock:30}]);return{items,subtotal:items.length?2000:0,clear:()=>setItems([])}}`,
    '@/hooks/useLoadingRouter': `const router={push:()=>{},replace:async()=>{}};export const useLoadingRouter=()=>router;`,
    '@/components/ui/LoadingLink': `import React from 'react';export default function Link(props){return <a {...props}/>}`,
    'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>}`,
    '@/components/support/NeedHelpButton': `export const NeedHelpButton=()=>null;`,
  };
  const built = await esbuild.build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Checkout from './app/(user)/checkout/page';import {ServiceBookings} from './components/user/ServiceBookings';import {Toaster} from 'react-hot-toast';createRoot(document.getElementById('root')).render(<>{location.search.includes('provider')?<ServiceBookings role="vendor"/>:<Checkout/>}<Toaster/></>);`, loader: 'tsx', resolveDir: root }, bundle: true, write: false, outfile: 'ui.js', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'isolated-adapters', setup(build) { build.onResolve({ filter: /.*/ }, args => args.path in modules ? { path: args.path, namespace: 'test' } : undefined); build.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: modules[args.path], loader: 'tsx', resolveDir: root })); } }] });
  const server = http.createServer((req, res) => {
    if (req.url === '/ui.js') { res.setHeader('content-type', 'application/javascript'); res.end(built.outputFiles.find(f => f.path.endsWith('.js')).text); }
    else if (req.url === '/logo.png') { res.setHeader('content-type', 'image/png'); res.end(fs.readFileSync(path.join(root, 'public/logo.png'))); }
    else { res.setHeader('content-type', 'text/html'); res.end('<html><body><div id="root"></div><script src="/ui.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const response = await fetch(bridge + url.pathname + url.search, { method: request.method(), headers: { 'content-type': 'application/json', 'Idempotency-Key': request.headers()['idempotency-key'] || '' }, ...(request.method() !== 'GET' ? { body: request.postData() } : {}) });
      await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
    });
    const url = `http://127.0.0.1:${server.address().port}/checkout`;
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('checkout-address')?.value === '12 Fixture Street, Apartment 2');
    await page.locator('#checkout-address').fill('Browser persisted delivery street');
    await page.getByText('Save this information for next time', { exact: true }).click();
    await page.getByRole('button', { name: 'Place Order', exact: true }).click();
    await page.getByRole('dialog', { name: 'Order confirmed!', exact: true }).waitFor();
    assert.equal(await page.getByText(/address could not be saved/).count(), 0);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('checkout-address')?.value === 'Browser persisted delivery street');
    await page.goto(url + '?provider=1');
    const active = page.locator('article').filter({ hasText: 'SERVICE fixture requirement' }).filter({ has: page.locator('form') });
    await active.waitFor();
    assert.match(await active.innerText(), /Agreed quantity: 2/);
    assert.match(await active.innerText(), /Service location:/);
    for (const status of ['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']) {
      await active.locator('select[name="status"]').selectOption(status);
      await active.locator('input[name="note"]').fill('Isolated provider completion evidence');
      if (status === 'SCHEDULED') await active.locator('input[name="date"]').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
      await active.getByRole('button', { name: 'Save', exact: true }).click();
      if (status !== 'COMPLETED') await active.getByText(new RegExp(`· ${status} ·`)).waitFor();
    }
    await page.waitForFunction(() => ![...document.querySelectorAll('article')].some(a => a.textContent.includes('SERVICE fixture requirement') && a.querySelector('form')));
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('checkout-address')?.value === 'Browser persisted delivery street');
    await page.locator('#checkout-address').fill('Browser one-time delivery street');
    await page.getByRole('button', { name: 'Place Order', exact: true }).click();
    await page.getByRole('dialog', { name: 'Order confirmed!', exact: true }).waitFor();
    await page.reload();
    await page.waitForFunction(() => document.getElementById('checkout-address')?.value === 'Browser persisted delivery street');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
