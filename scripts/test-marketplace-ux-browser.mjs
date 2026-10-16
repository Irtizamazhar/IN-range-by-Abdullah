/* Real UI, React Query and save hooks; navigation/session adapters and HTTP fixtures.
 * No database writes, OAuth calls or mail. */
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
const pixel = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Cpath fill="%23ddd" d="M0 0h40v40H0z"/%3E%3C/svg%3E';
const product = { _id: 'p1', name: 'Test Product', images: [pixel], category: 'Electronics', price: 1200, stock: 4, available: true };
const entry = `
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import {Toaster} from 'react-hot-toast';
import {LoginExperience} from './components/auth/LoginExperience';
import {PakistanCitySelect} from './components/ui/PakistanCitySelect';
import {PakistanMobileInput} from './components/ui/PakistanMobileInput';
import {HomeProductCard} from './components/user/HomeProductCard'; import {ProductCard} from './components/user/ProductCard';
import {SaveProductButton} from './components/user/SaveProductButton';
import {HomeMarketplace} from './components/user/HomeMarketplace'; import {HeroSection} from './components/user/HeroSection';
import {WantForm} from './components/user/WantForm';
import AccountPage from './app/(user)/account/page';
const params=new URLSearchParams(location.search), screen=params.get('screen')||'saved';
const product=${JSON.stringify(product)};
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
function App(){const [city,setCity]=useState('Legacy Town'),[phone,setPhone]=useState('0300-1234567');
 if(screen==='auth')return <LoginExperience initialRole={params.get('role')||'customer'} initialMode={params.get('mode')||'signin'} googleEnabled/>;
 if(screen==='controls')return <main className="mx-auto max-w-xl space-y-6 p-5"><label>City<PakistanCitySelect aria-label="City" name="city" value={city} onValueChange={setCity}/></label><label>Mobile<PakistanMobileInput aria-label="Mobile" value={phone} onValueChange={setPhone}/></label><output data-phone-value>{phone}</output><button type="button">Next field</button></main>;
 if(screen==='want')return <main className="mx-auto max-w-xl p-5"><WantForm categories={['Electronics']} onSuccess={want=>{window.__submittedWant=want}}/></main>;
 if(screen==='home')return <><HeroSection sellNowHref="/sell"/><HomeMarketplace products={[]} services={[]} gifts={[]} wants={[{id:'w1',title:'Need a laptop',requestType:'PRODUCT',city:'Lahore',photo:null,createdAt:new Date(),budgetMin:null,budgetMax:null,budgetFlexible:true,_count:{offers:1,interests:3}}]} stores={[{id:'v1',shopName:'Trusted Seller',storeSlug:'trusted-seller',primaryCategory:'Electronics',label:null,rating:{ratingAvg:4.8,reviewCount:6}},{id:'v2',shopName:'Second Seller',storeSlug:'second-seller',primaryCategory:'Home',label:null,rating:{ratingAvg:4.6,reviewCount:8}}]}/></>;
 if(screen==='account')return <AccountPage/>;
 return <main className="mx-auto max-w-5xl p-5 pt-24"><section data-home-card className="w-52"><HomeProductCard product={product}/></section><section data-list-card className="w-64"><ProductCard product={product}/></section><section data-detail-heart><SaveProductButton productId="p1" name="Test Product"/></section></main>;
}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><App/><Toaster toastOptions={{duration:600}}/></QueryClientProvider>);
`;

async function run() {
  const modules = {
    'next-auth/react': `import {useSyncExternalStore} from 'react'; const subs=new Set(); let who=new URLSearchParams(location.search).get('customer')||'none';window.__setCustomer=value=>{who=value;for(const fn of subs)fn();};export function useSession(){const id=useSyncExternalStore(fn=>{subs.add(fn);return()=>subs.delete(fn)},()=>who);return{data:id==='none'?null:{user:{id,role:'customer',name:'Test Customer'}},status:id==='none'?'unauthenticated':'authenticated',update:async()=>{}};}export const signIn=async(...args)=>{window.__oauth=args;return{ok:true}};export const getSession=async()=>null;export const signOut=async()=>{};`,
    'next/navigation': `export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>location.pathname; export const useRouter=()=>({push:async url=>{window.__navigation=url},replace:async url=>{window.__navigation=url},refresh:async()=>{}});`,
    '@/hooks/useLoadingRouter': `export {useRouter as useLoadingRouter} from 'next/navigation';`,
    '@/components/ui/LoadingLink': `import React from 'react';export function LoadingLink({children,...props}){return <a {...props}>{children}</a>};export default LoadingLink;`,
    '@/components/user/LogoMark': `import React from 'react';export const LogoMark=({className})=><span className={className}>JORO</span>;`,
    '@/components/auth/AuthBrandPanel': `import React from 'react';export const AuthBrandPanel=({className})=><aside className={className}/>;`,
    '@/context/CustomerAuthContext': `export const useCustomerAuth=()=>({openAuthModal:async()=>{window.__login='/login?role=customer&mode=signin&callbackUrl='+encodeURIComponent(location.pathname+location.search)},isCustomer:true,authLoading:false,requireCustomer:fn=>fn()});`,
    '@/context/PostWantContext': `export const usePostWant=()=>({openPostWant:()=>{window.__wantOpens=(window.__wantOpens||0)+1}});`,
    '@/context/CartContext': `export const useCart=()=>({items:[],addItem:()=>{},clear:()=>{}});`,
    '@/lib/public-services': `export const serviceCities=value=>Array.isArray(value)?value:[];`,
    'next/image': `import React from 'react';export default function Image({src,fill,priority,unoptimized,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'}:props.style}/>;}`,
  };
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
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ux.css"></head><body><div id="root"></div><script src="/ux.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.JORO_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file => fs.existsSync(file));
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    for (const width of [360, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width === 360, hasTouch: width === 360 });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/vendor/me', route => route.fulfill({ status: 401, json: {} }));
      // All four role/mode combinations use the real form and scoped CSS.
      for (const role of ['customer', 'vendor']) for (const mode of ['signin', 'signup']) {
        await page.goto(`${base}/?screen=auth&role=${role}&mode=${mode}`);
        const email = page.getByLabel('Email', { exact: true }); await email.waitFor();
        const label = page.locator('label[for="auth-email"]');
        const labelBox = await label.boundingBox(), inputBox = await email.boundingBox();
        assert.ok(inputBox.y - labelBox.y - labelBox.height >= 6, 'label/input spacing');
        const passwordBox = await page.locator('#auth-password').boundingBox();
        assert.ok(passwordBox.y >= inputBox.y + inputBox.height + 16, 'fields must have comfortable separation');
        const submitBox = await page.locator('button.joro-auth-primary[type="submit"]').boundingBox();
        assert.ok(submitBox.y >= passwordBox.y + passwordBox.height);
        if (mode === 'signin') {
          const remember = await page.locator('label:has(input[type="checkbox"])').boundingBox();
          const forgot = await page.getByRole(role === 'vendor' ? 'link' : 'button', { name: 'Forgot password?', exact: true }).boundingBox();
          assert.ok(remember.x + remember.width + 8 <= forgot.x, 'Remember/Forgot must not crowd each other');
          assert.ok(forgot.height >= 44, 'Forgot password touch target');
        }
        if (mode === 'signup') {
          const phone = page.locator('#auth-phone');
          await phone.fill('3001234567');
          assert.equal(await phone.inputValue(), '300-1234567');
          assert.equal(await phone.evaluate(node => node.parentElement.textContent.includes('+92')), true);
        }
        if (role === 'customer') {
          const google = page.getByRole('button', { name: 'Continue with Google' });
          await google.scrollIntoViewIfNeeded(); assert.equal(await google.isEnabled(), true);
          const googleBox = await google.boundingBox(), submitNow = await page.locator('button.joro-auth-primary[type="submit"]').boundingBox();
          assert.ok(googleBox.y - submitNow.y - submitNow.height >= 24, 'OR/social controls need clear separation');
          await google.click(); assert.equal(await page.evaluate(() => window.__oauth[0]), 'google');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      // City keyboard/custom names and phone paste/caret/editing on actual controls.
      await page.goto(`${base}/?screen=controls`);
      const city = page.getByRole('combobox', { name: 'City' }); await city.waitFor();
      assert.equal(await city.inputValue(), 'Legacy Town');
      await city.fill('lah');
      const lahore = page.getByRole('option', { name: 'Lahore', exact: true });
      if (width === 360) await lahore.tap(); else await lahore.click();
      assert.equal(await city.inputValue(), 'Lahore');
      await city.fill('Skardu'); await city.press('ArrowDown'); await city.press('Enter');
      assert.equal(await city.inputValue(), 'Skardu');
      await city.fill('Unlisted Test Town'); await page.getByRole('status').filter({ hasText: 'No matching cities' }).waitFor();
      await city.press('Escape'); assert.equal(await city.getAttribute('aria-expanded'), 'false');
      assert.equal(await city.inputValue(), 'Unlisted Test Town');
      const phone = page.getByRole('textbox', { name: 'Mobile' });
      for (const paste of ['0300-1234567', '+92 300 1234567', '0092 3001234567']) {
        await phone.fill(''); await phone.focus();
        await phone.evaluate((node, text) => { const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', text); node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })); }, paste);
        assert.equal(await phone.inputValue(), '300-1234567');
        assert.equal(await page.locator('[data-phone-value]').textContent(), '0300-1234567');
      }
      await phone.fill(''); await phone.pressSequentially('300123456789');
      assert.equal(await phone.inputValue(), '300-1234567');
      await phone.evaluate(node => node.setSelectionRange(5, 5)); await phone.press('Backspace');
      assert.equal(await phone.inputValue(), '300-234567');
      assert.equal(await phone.evaluate(node => node.selectionStart), 3);
      await phone.press('1'); assert.equal(await phone.inputValue(), '300-1234567');
      await phone.press('Tab'); assert.equal(await page.getByRole('button', { name: 'Next field' }).evaluate(node => document.activeElement === node), true);
      // Want creation still submits a plain city string to the existing endpoint.
      let postedWant;
      await page.route('**/api/wants', async route => { postedWant = route.request().postDataJSON(); await route.fulfill({ json: { want: { id: 'w-new', status: 'PENDING_APPROVAL' } } }); });
      await page.goto(`${base}/?screen=want&customer=customer-a`);
      await page.locator('input[name="title"]').fill('A new study laptop');
      await page.locator('select[name="category"]').selectOption('Electronics');
      await page.getByRole('combobox', { name: 'City' }).fill('Taxila');
      await page.getByRole('option', { name: 'Taxila', exact: true }).click();
      await page.getByRole('checkbox', { name: /My budget is flexible/ }).check();
      await page.getByRole('button', { name: 'Submit Want for review' }).click();
      await page.waitForFunction(() => window.__submittedWant?.id === 'w-new');
      assert.equal(postedWant.city, 'Taxila'); assert.equal(postedWant.requestType, 'PRODUCT');
      // Exact homepage CTA and seller/Join visuals preserve destinations and actions.
      await page.goto(`${base}/?screen=home`);
      await page.getByRole('button', { name: 'Request a Want' }).click();
      assert.equal(await page.evaluate(() => window.__wantOpens), 1);
      const sellers = page.getByRole('region', { name: 'Top Sellers' });
      await sellers.scrollIntoViewIfNeeded();
      assert.equal(await sellers.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(250, 250, 250)');
      assert.equal(await sellers.getByRole('link', { name: /Trusted Seller/ }).getAttribute('href'), '/stores/trusted-seller');
      const join = page.locator('a[href="/wants/w1"]');
      assert.match(await join.innerText(), /Join Request/);
      const joinBox = await join.getByText('Join Request').boundingBox(); assert.ok(joinBox.height >= 44);
      await join.click(); assert.equal(new URL(page.url()).pathname, '/wants/w1');
      // Real shared hook/card interactions with per-owner persistent HTTP fixtures.
      const records = new Map([['customer-a', new Set()], ['customer-b', new Set()]]);
      let owner = 'customer-a', fail = false, hold = false, release, writes = 0;
      await page.route('**/api/customer/saved-products**', async route => {
        const request = route.request(), set = records.get(owner);
        if (request.method() === 'GET') return route.fulfill({ json: { ids: [...set] } });
        writes++; if (hold) await new Promise(resolve => { release = resolve; });
        if (fail) return route.fulfill({ status: 503, json: { error: 'Could not save product. Try again.' } });
        if (request.method() === 'DELETE') set.delete('p1'); else set.add('p1');
        return route.fulfill({ json: { ok: true, saved: request.method() !== 'DELETE' } });
      });
      await page.route('**/api/customer/account**', route => route.fulfill({ json: { profile: { name: 'Test Customer', createdAt: '2026-01-01', hasLocalPassword: true }, savedProducts: records.get(owner).has('p1') ? [{ ...product, available: false, stock: 0 }] : [], counts: {}, addresses: [], orders: [], wants: [], followedStores: [], pagination: { orderPages: 0, wantPages: 0 } } }));
      await page.goto(`${base}/?screen=saved&customer=customer-a`);
      const homeHeart = page.locator('[data-home-card] button[aria-pressed]'), listHeart = page.locator('[data-list-card] button[aria-pressed]'), detailHeart = page.locator('[data-detail-heart] button');
      await homeHeart.waitFor(); await page.waitForFunction(() => !document.querySelector('[data-home-card] button[aria-pressed]').disabled);
      fail = true; await homeHeart.click(); await page.getByText('Could not save product. Try again.', { exact: true }).waitFor();
      assert.equal(await homeHeart.getAttribute('aria-pressed'), 'false');
      await page.mouse.move(0, 0);
      await page.getByText('Could not save product. Try again.', { exact: true }).waitFor({ state: 'hidden' });
      fail = false; hold = true; const before = writes;
      await homeHeart.click(); await page.waitForFunction(() => document.querySelector('[data-home-card] button[aria-pressed]').disabled);
      await detailHeart.click(); await page.waitForTimeout(50);
      assert.equal(writes, before + 1); assert.equal(await homeHeart.getAttribute('aria-pressed'), 'false', 'pending is not a confirmed save');
      release(); hold = false;
      await page.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed]')].every(node => node.getAttribute('aria-pressed') === 'true'));
      assert.equal(await listHeart.getAttribute('aria-pressed'), 'true');
      await page.reload(); await page.waitForFunction(() => document.querySelector('[data-detail-heart] button')?.getAttribute('aria-pressed') === 'true');
      await page.evaluate(() => window.__setCustomer('none'));
      await page.waitForFunction(() => document.querySelector('[data-detail-heart] button')?.getAttribute('aria-pressed') === 'false');
      await detailHeart.click(); assert.match(await page.evaluate(() => window.__login), /callbackUrl=/);
      owner = 'customer-b'; await page.evaluate(() => window.__setCustomer('customer-b'));
      await page.waitForFunction(() => !document.querySelector('[data-home-card] button[aria-pressed]').disabled);
      assert.equal(await homeHeart.getAttribute('aria-pressed'), 'false', 'another owner cannot see saved state');
      owner = 'customer-a'; await page.evaluate(() => window.__setCustomer('customer-a'));
      await page.waitForFunction(() => document.querySelector('[data-detail-heart] button')?.getAttribute('aria-pressed') === 'true');
      await page.goto(`${base}/?screen=account&tab=saved&customer=customer-a`);
      await page.getByRole('heading', { name: 'Saved Items', exact: true }).waitFor();
      await page.getByText('Currently unavailable', { exact: false }).waitFor();
      await page.getByRole('button', { name: /Remove Test Product from saved products/ }).click();
      await page.getByRole('heading', { name: 'Nothing saved yet' }).waitFor();
      assert.equal(records.get('customer-a').size, 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: customer/vendor auth spacing and Google action, +92 editing/paste/caret, city search/keyboard/custom values, Want/Join actions, neutral sellers, heart failures/duplicates/shared state, refresh/session owner isolation, Saved Items removal/empty/unavailable`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
