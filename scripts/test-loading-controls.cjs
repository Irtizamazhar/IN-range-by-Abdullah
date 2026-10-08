/** Isolated browser regression checks. All requests are intercepted; no real records are modified. */
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');

async function main() {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React, {useState, Suspense} from 'react';
      import {createRoot} from 'react-dom/client';
      import {Toaster, toast} from 'react-hot-toast';
      import {LoadingButton} from './components/ui/LoadingButton';
      import {LoadingForm} from './components/ui/LoadingForm';
      import LoadingLink from './components/ui/LoadingLink';
      import {PageSkeleton} from './components/ui/PageSkeleton';
      import {usePageLoading} from './hooks/usePageLoading';
      import {StoreFollowButton} from './components/user/StoreFollowButton';
      import {UpdateStatusBtn} from './components/orders/UpdateStatusBtn';
      import AdminWants from './app/admin/wants/page';
      window.clearToasts = () => toast.remove();
      async function request(path) { const r=await fetch(path,{method:'POST'});const data=await r.json();if(!r.ok)throw new Error(data.error); }
      let serverReady=false, resolveServer;
      const serverPromise=new Promise(resolve=>{resolveServer=()=>{serverReady=true;resolve();};});
      window.resolveServer=()=>resolveServer();
      function Destination(){ if(!serverReady)throw serverPromise;const [loading,setLoading]=useState(true);usePageLoading(loading);window.resolvePage=()=>setLoading(false);return loading?<PageSkeleton label="Loading destination data…"/>:<p>Destination ready</p>; }
      function Fixture(){const [count,setCount]=useState(0);const [route,setRoute]=useState(false);window.testNavigate=()=>setRoute(true);
        return <><Toaster toastOptions={{duration:10000}}/>
          <div data-testid="controls">
            <LoadingButton data-testid="save" className="action" loadingLabel="Saving…" successMessage="Saved successfully" onClick={()=>request('/test/save')}>Save changes</LoadingButton>
            <LoadingButton data-testid="other" className="action" loadingLabel="Adding…" onClick={()=>request('/test/other')}>Add item</LoadingButton>
            <LoadingButton data-testid="instant" className="action" onClick={()=>setCount(n=>n+1)}>Toggle {count}</LoadingButton>
            <LoadingButton data-testid="icon" className="action icon" aria-label="Save item" loadingLabel="Saving item…" onClick={()=>request('/test/icon')}>♡</LoadingButton>
          </div>
          <LoadingForm data-testid="form" onSubmit={e=>{e.preventDefault();return request('/test/form');}}>
            <input aria-label="Required title" required defaultValue="Example"/>
            <LoadingButton className="action" data-testid="submit" loadingLabel="Submitting…">Submit form</LoadingButton>
            <LoadingButton type="button" data-testid="form-instant" onClick={()=>setCount(n=>n+1)}>Open options</LoadingButton>
          </LoadingForm>
          <div data-testid="customer"><StoreFollowButton vendorId="example" initialFollowers={3}/></div>
          <div data-testid="vendor"><UpdateStatusBtn currentStatus="pending" statusUrl="/test/vendor" onSuccess={()=>request('/test/vendor-reload')}/></div>
          <div data-testid="admin"><AdminWants/></div>
          <LoadingLink href="/destination" data-testid="nav" className="action">Open destination</LoadingLink>
          <LoadingLink href="#instant-section" data-testid="hash">Jump to section</LoadingLink>
          <Suspense fallback={<PageSkeleton label="Loading destination…"/>}>{route?<Destination/>:<p>Original page</p>}</Suspense>
          <div id="instant-section">Section</div>
        </>;
      }
      createRoot(document.getElementById('root')).render(<Fixture/>);
    ` },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic', outfile: 'loading-tests.js',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'isolated-next-contexts', setup(builder) {
      builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onResolve({ filter: /context\/CustomerAuthContext$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
        if (args.path.endsWith('CustomerAuthContext')) return { contents: `export const useCustomerAuth=()=>({isCustomer:true,authLoading:false,openAuthModal:()=>Promise.resolve()});`, loader:'js' };
        if (args.path.endsWith('navigation')) return { contents: `const router={push:()=>window.testNavigate(),replace:()=>window.testNavigate(),refresh:()=>{},back:()=>{},forward:()=>{},prefetch:()=>{}};export const useRouter=()=>router;`, loader:'js' };
        return { contents: `import React from 'react';export default React.forwardRef(function Link({children,href,prefetch,replace,scroll,...props},ref){return <a {...props} href={href} ref={ref}>{children}</a>});`, loader:'jsx', resolveDir:process.cwd() };
      });
    } }],
  });
  const script = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const counts = new Map();
  const gates = new Map();
  const page = await browser.newPage({viewport:{width:1200,height:1000}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('http://loading.test/**', async route => {
      const request = route.request();const path = new URL(request.url()).pathname;
      if (path === '/app.js') return route.fulfill({contentType:'text/javascript',body:script});
      if (path === '/api/admin/wants' && request.method() === 'GET') return route.fulfill({json:{wants:[1,2].map(id=>({id:String(id),title:'Want '+id,description:'Example',category:'Other',city:'Lahore',budgetMax:null,status:'PENDING_MODERATION',moderationReason:null,createdAt:'2026-10-08',customer:{name:'Customer',email:'test@example.test'},_count:{offers:0,interests:0}}))}});
      if (request.method() !== 'GET') {
        counts.set(path,(counts.get(path)||0)+1);
        gates.set(path,({status=200,json={}}={})=>route.fulfill({status,json}));
        return;
      }
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>
        *{box-sizing:border-box}body{font:15px Arial;color:#103c29;margin:24px}button,a,input{font:inherit}button,a.action{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border:1px solid #dce5d1;border-radius:12px;background:#b7e33a;color:#103c29;text-decoration:none}.icon{width:44px;height:44px;padding:8px}form,[data-testid]{margin-block:10px}button svg{width:18px;height:18px} [role=status]{margin:0} ${css}
      </style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`});
    });
    await page.goto('http://loading.test/');
    const waitPending = locator => locator.waitFor({state:'visible'}).then(()=>page.waitForFunction(element=>element.dataset.loading==='true', locator.elementHandle()));
    async function pending(locator) { await locator.waitFor(); await assertEventually(async()=>assert.equal(await locator.getAttribute('data-loading'),'true')); assert.equal(await locator.getAttribute('aria-busy'),'true'); }
    async function idle(locator) { await assertEventually(async()=>assert.notEqual(await locator.getAttribute('data-loading'),'true')); }
    async function release(path, response) { await assertEventually(async()=>assert.ok(gates.has(path),`${path} requested`)); const fulfill=gates.get(path);gates.delete(path);await fulfill(response); }
    async function size(locator) { const box=await locator.boundingBox();return {width:box.width,height:box.height}; }

    const save=page.getByTestId('save'); const before=await size(save);
    await save.click();await pending(save);
    assert.equal(await save.isDisabled(),true);assert.deepEqual(await size(save),before);
    await save.evaluate(button=>{button.click();button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    assert.equal(counts.get('/test/save'),1,'duplicate clicks produce only one request');
    assert.equal(await page.getByTestId('other').isDisabled(),false);
    await page.getByTestId('other').click();await pending(page.getByTestId('other'));
    await page.getByTestId('instant').click();await idle(page.getByTestId('instant'));
    assert.match(await page.getByTestId('instant').innerText(),/Toggle 1/);
    await release('/test/other');await idle(page.getByTestId('other'));await pending(save);
    await release('/test/save');await idle(save);assert.deepEqual(await size(save),before);
    await page.getByText('Saved successfully',{exact:true}).waitFor();
    await page.evaluate(()=>window.clearToasts());
    await save.click();await pending(save);await release('/test/save',{status:500,json:{error:'Save rejected. Try again.'}});await idle(save);
    await page.getByText('Save rejected. Try again.',{exact:true}).waitFor();assert.equal(await save.isEnabled(),true);
    await save.click();await release('/test/save');await idle(save);assert.equal(counts.get('/test/save'),3);
    console.log('PASS shared buttons: concurrent actions, duplicate guard, stable size, errors and retry, instant actions');

    const icon=page.getByTestId('icon'),iconBefore=await size(icon);await icon.click();await pending(icon);assert.deepEqual(await size(icon),iconBefore);assert.equal(await icon.getAttribute('aria-label'),'Saving item…');await release('/test/icon');await idle(icon);
    const submit=page.getByTestId('submit'), submitBefore=await size(submit);
    await submit.click();await pending(submit);assert.deepEqual(await size(submit),submitBefore);
    assert.equal(await page.getByTestId('form-instant').isEnabled(),true);
    await page.getByTestId('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});assert.equal(counts.get('/test/form'),1);
    await release('/test/form',{status:400,json:{error:'Please correct the form.'}});await idle(submit);
    await page.getByLabel('Required title').fill('');await submit.click();await idle(submit);assert.equal(counts.get('/test/form'),1,'invalid form does not start loader/request');
    await page.getByLabel('Required title').fill('Retry');await page.getByLabel('Required title').press('Enter');await pending(submit);await release('/test/form');await idle(submit);
    console.log('PASS forms: click and Enter submissions, validation, duplicate prevention, retry, accessible icon button');

    const customer=page.getByTestId('customer').locator('button');
    await customer.click();await pending(customer);await release('/api/stores/example/follow',{status:500,json:{error:'Follow failed'}});await idle(customer);
    await page.getByText('Follow failed',{exact:true}).waitFor();assert.match(await customer.innerText(),/Follow/);
    await customer.click();await release('/api/stores/example/follow',{json:{following:true,followers:4}});await idle(customer);assert.match(await customer.innerText(),/Following/);
    console.log('PASS customer store follow: server rejection, successful retry and feedback');

    const vendor=page.getByTestId('vendor');await vendor.getByRole('button',{name:'Confirm order',exact:true}).click();
    await idle(vendor.getByRole('button',{name:'Confirm order',exact:true}));
    const confirm=vendor.getByRole('button',{name:'Confirm',exact:true});await confirm.click();const vendorButton=vendor.locator('button[data-loading="true"]');await pending(vendorButton);
    await release('/test/vendor',{status:500,json:{error:'Order update rejected'}});await idle(confirm);await page.getByText('Order update rejected',{exact:true}).waitFor();
    await confirm.click();await release('/test/vendor');await pending(vendorButton);
    await release('/test/vendor-reload');await confirm.waitFor({state:'detached'});
    console.log('PASS vendor order: instant modal, failed update retry, pending through awaited reload');

    const admin=page.getByTestId('admin');let approvals=admin.getByRole('button',{name:'Approve',exact:true});await approvals.first().click();
    await pending(admin.locator('button[data-loading="true"]').first());assert.equal(await approvals.last().isEnabled(),true);
    await release('/api/admin/wants',{status:403,json:{error:'Moderation denied'}});
    await page.getByText('Moderation denied',{exact:true}).waitFor();await assertEventually(async()=>assert.equal(await admin.locator('button[data-loading="true"]').count(),0));
    await approvals.first().click();await release('/api/admin/wants');await assertEventually(async()=>assert.equal(await admin.locator('button[data-loading="true"]').count(),0));await page.getByText('Want updated',{exact:true}).waitFor();
    console.log('PASS admin moderation: independent rows, failed request retry and successful reload');

    await page.getByTestId('hash').click();await idle(page.getByTestId('hash'));
    const nav=page.getByTestId('nav'),navBefore=await size(nav);await nav.click();await pending(nav);assert.deepEqual(await size(nav),navBefore);
    await page.evaluate(()=>window.resolveServer());await page.getByRole('status',{name:'Loading destination data…'}).waitFor();await pending(nav);
    await page.evaluate(()=>window.resolvePage());await page.getByText('Destination ready',{exact:true}).waitFor();await idle(nav);
    assert.deepEqual(errors,[]);console.log('PASS navigation: pending through suspended route AND client data, skeletons, no loader for hash jump');
  } finally { await browser.close(); }
}

async function assertEventually(check) {
  const deadline=Date.now()+10000;let error;
  while(Date.now()<deadline){try{await check();return;}catch(cause){error=cause;}await new Promise(resolve=>setTimeout(resolve,20));}
  throw error;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
