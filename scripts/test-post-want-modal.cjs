/** Real modal/form in an isolated browser. Every HTTP request is mocked; no database writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const loadConfig = require('tailwindcss/loadConfig');
const { chromium } = require('playwright-core');

async function eventually(check) {
  const deadline = Date.now() + 10000; let failure;
  while (Date.now() < deadline) { try { return await check(); } catch (error) { failure = error; } await new Promise(resolve => setTimeout(resolve, 20)); }
  throw failure;
}

async function main() {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';
      import {Toaster} from 'react-hot-toast';
      import {PostWantProvider} from './context/PostWantContext';
      import {PostWantButton} from './components/user/PostWantButton';
      window.navigations=[];window.wantChanges=0;window.addEventListener('wants-changed',()=>window.wantChanges++);
      createRoot(document.getElementById('root')).render(<><Toaster/><PostWantProvider>
        <header><a href="#outside" id="outside-link">Outside page link</a></header>
        <PostWantButton data-testid="post" className="rounded-xl bg-brand-primary px-5 py-3 font-bold">+ Post a Want</PostWantButton>
        <PostWantButton data-testid="prefilled" initialTitle="Study desk" className="rounded-xl border px-5 py-3">Post search</PostWantButton>
        <div style={{height:1600}}>Feed stays on this page.</div>
      </PostWantProvider></>);
    ` },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic', outfile: 'post-want-tests.js',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'isolated-browser-context', setup(builder) {
      builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({path:args.path,namespace:'fixture'}));
      builder.onResolve({ filter: /context\/CustomerAuthContext$/ }, args => ({path:args.path,namespace:'fixture'}));
      builder.onLoad({ filter: /.*/, namespace:'fixture' }, args => {
        if (args.path.endsWith('CustomerAuthContext')) return {loader:'js',resolveDir:process.cwd(),contents:`
          import {useSyncExternalStore} from 'react';let customer=true;const subscribers=new Set();
          window.loginCalls=0;window.setTestAuth=value=>{customer=value;subscribers.forEach(fn=>fn());};
          const subscribe=fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);};
          export function useCustomerAuth(){const isCustomer=useSyncExternalStore(subscribe,()=>customer,()=>true);return {isCustomer,authLoading:false,openAuthModal:()=>{window.loginCalls++;return Promise.resolve();}};}
        `};
        if (args.path.endsWith('navigation')) return {loader:'js',contents:`const router={push:href=>{window.navigations.push(href);history.pushState(null,'',href);},replace:href=>{window.navigations.push(href);history.replaceState(null,'',href);},refresh:()=>{},back:()=>{},forward:()=>{},prefetch:()=>{}};export const useRouter=()=>router;export const usePathname=()=>'/wants';`};
        return {loader:'jsx',resolveDir:process.cwd(),contents:`import React from 'react';export default React.forwardRef(function Link({href,children,prefetch,replace,scroll,...props},ref){return <a {...props} ref={ref} href={href}>{children}</a>});`};
      });
    }}],
  });
  const script = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const moduleCss = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
  const config = loadConfig(require('node:path').resolve('tailwind.config.ts'));
  const css = (await postcss([tailwind({...config,content:['./components/user/PostWant*.tsx','./components/user/WantForm.tsx','./components/ui/Loading*.tsx']}),require('autoprefixer')]).process(fs.readFileSync('app/globals.css','utf8'),{from:'app/globals.css'})).css;
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page = await browser.newPage({viewport:{width:1200,height:900}});
  const counts = new Map(), gates = new Map(), requests = [], errors = [];
  let rejectCategories = false, holdCategories = false;
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      assert.equal(url.origin,'http://modal.test','fixture must never contact a real API');
      if(path==='/app.js') return route.fulfill({contentType:'text/javascript',body:script});
      if(path==='/api/categories') {
        counts.set(path,(counts.get(path)||0)+1);
        if(holdCategories){gates.set(path,response=>route.fulfill(response));return;}
        return route.fulfill(rejectCategories?{status:500,json:{error:'Unavailable'}}:{json:[{name:'Furniture'},{name:'Electronics'}]});
      }
      if(request.method()==='POST') {
        counts.set(path,(counts.get(path)||0)+1);requests.push({path,body:request.postData()});
        gates.set(path,response=>route.fulfill(response));return;
      }
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>${css}\n${moduleCss}</style></head><body style="padding:24px"><div id="root"></div><script src="/app.js"></script></body></html>`});
    });
    await page.goto('http://modal.test/wants');
    const dialog = page.getByRole('dialog'), trigger = page.getByTestId('post');
    const title = () => dialog.locator('input[name=title]');
    const save = () => dialog.locator('footer button[type=submit]');
    const input = name => dialog.locator(`[name="${name}"]`);
    async function open(prefilled=false){await page.getByTestId(prefilled?'prefilled':'post').click();await dialog.waitFor();await title().waitFor();}
    async function release(path,response){await eventually(()=>assert.ok(gates.has(path),`${path} requested`));const fulfill=gates.get(path);gates.delete(path);await fulfill(response);}
    async function pending(){await eventually(async()=>assert.equal(await save().getAttribute('data-loading'),'true'));assert.equal(await save().isDisabled(),true);}
    async function idle(){await eventually(async()=>assert.notEqual(await save().getAttribute('data-loading'),'true'));assert.equal(await save().isEnabled(),true);}
    async function fill(){await title().fill('Wooden study desk');await input('category').selectOption('Furniture');await input('city').fill('Lahore');await input('max').fill('15000');}

    await open();assert.equal(page.url(),'http://modal.test/wants');assert.deepEqual(await page.evaluate(()=>window.navigations),[]);
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    await eventually(async()=>assert.equal(await title().evaluate(node=>document.activeElement===node),true));
    for(let i=0;i<25;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id==='outside-link'),false,'Tab cannot leave modal for page controls');}
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    assert.equal(await trigger.evaluate(node=>document.activeElement===node),true);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    await open(true);assert.equal(await title().inputValue(),'Study desk');
    assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),false);
    await title().fill('Desk with drawers');
    await page.keyboard.press('Escape');await dialog.getByRole('heading',{name:'Discard this Want?'}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Keep editing'}).evaluate(node=>document.activeElement===node),true);
    await dialog.getByRole('button',{name:'Keep editing'}).click();assert.equal(await title().inputValue(),'Desk with drawers');
    assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true,'unsaved changes protect browser navigation');
    await page.mouse.click(2,2);await dialog.getByRole('heading',{name:'Discard this Want?'}).waitFor();await page.keyboard.press('Escape');await title().waitFor();assert.equal(await title().inputValue(),'Desk with drawers');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.getByRole('button',{name:'Discard',exact:true}).click();await dialog.waitFor({state:'detached'});
    assert.equal(await page.getByTestId('prefilled').evaluate(node=>document.activeElement===node),true);
    console.log('PASS modal lifecycle: no navigation, initial focus, native focus containment, Escape/backdrop, dirty confirmation, beforeunload guard, retained input, focus and scroll restoration');

    rejectCategories=true;await trigger.click();await dialog.getByRole('alert').waitFor();assert.equal(await save().isDisabled(),true);
    rejectCategories=false;holdCategories=true;const retry=dialog.locator('button').filter({hasText:'Retry'});await retry.click();
    await eventually(async()=>assert.equal(await retry.getAttribute('data-loading'),'true'));assert.equal(await retry.isDisabled(),true);
    await release('/api/categories',{json:[{name:'Furniture'},{name:'Electronics'}]});holdCategories=false;await title().waitFor();
    await save().click();assert.equal(counts.get('/api/wants')||0,0);assert.equal(await title().evaluate(node=>node.validity.valueMissing),true);
    await fill();await input('quantity').fill('0');await save().click();assert.equal(await input('quantity').evaluate(node=>node.validity.rangeUnderflow),true);assert.equal(counts.get('/api/wants')||0,0);
    await input('quantity').fill('1');await input('min').fill('20000');await save().click();await dialog.getByText('Please provide a valid budget range.',{exact:true}).waitFor();assert.equal(counts.get('/api/wants')||0,0);
    await input('min').fill('');await dialog.getByText('Add More Details',{exact:true}).click();await input('description').fill('Please include a solid wooden top.');
    await input('photo').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});await dialog.getByText('Choose a JPG, PNG, or WebP image up to 5 MB.',{exact:true}).waitFor();
    const photo={name:'reference.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lJkAAAAASUVORK5CYII=','base64')};
    await input('photo').setInputFiles(photo);await dialog.getByAltText('Your selected reference').waitFor();
    await dialog.getByRole('button',{name:'Remove reference image'}).click();assert.equal(await dialog.getByAltText('Your selected reference').count(),0);assert.equal(await input('photo').evaluate(node=>node.files.length),0);
    await input('photo').setInputFiles(photo);await dialog.getByAltText('Your selected reference').waitFor();
    console.log('PASS categories failure/retry, required fields, quantity and budget validation, invalid image feedback, preview and removal');

    fs.mkdirSync('coverage/post-want-modal',{recursive:true});
    for(const viewport of [{width:1200,height:900},{width:390,height:700},{width:320,height:568}]){
      await page.setViewportSize(viewport);await title().scrollIntoViewIfNeeded();
      const panel=await dialog.boundingBox(),footer=await dialog.locator('footer').boundingBox();
      assert.ok(panel.width<=viewport.width && panel.x>=0,'modal fits viewport width');assert.ok(footer.y>=0 && footer.y+footer.height<=viewport.height,'footer visible without scrolling page');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');
      await page.screenshot({path:`coverage/post-want-modal/form-${viewport.width}.png`});
      await input('photo').evaluate(node=>node.closest('[class*="overflow-y-auto"]').scrollTop=99999);
      const afterFooter=await dialog.locator('footer').boundingBox();assert.deepEqual(afterFooter,footer,'footer remains in place while form scrolls');
      await page.screenshot({path:`coverage/post-want-modal/details-${viewport.width}.png`});
    }
    console.log('PASS actual theme CSS at desktop, 390px and 320px: contained card width, independent form scroll, persistent visible footer');

    await page.setViewportSize({width:1200,height:900});const before=await save().boundingBox();await save().click();await pending();
    assert.deepEqual(await save().boundingBox(),before,'Save dimensions stay fixed');
    await save().evaluate(node=>{node.click();node.form.requestSubmit();node.form.requestSubmit();});assert.equal(counts.get('/api/upload'),1);
    await page.keyboard.press('Escape');await dialog.waitFor();assert.equal(await dialog.getByRole('heading',{name:'Discard this Want?'}).count(),0,'cannot close during a submission');
    await release('/api/upload',{status:500,json:{error:'Photo upload unavailable'}});await idle();await dialog.getByText('Photo upload unavailable',{exact:true}).waitFor();
    assert.equal(await title().inputValue(),'Wooden study desk');assert.equal(await input('photo').evaluate(node=>node.files[0].name),'reference.png');await dialog.getByAltText('Your selected reference').waitFor();
    await save().click();await pending();await release('/api/upload',{json:{url:'/uploads/wants/mock-reference.png'}});await pending();
    await release('/api/wants',{status:500,json:{error:'Submission temporarily failed'}});await idle();await dialog.getByText('Submission temporarily failed',{exact:true}).waitFor();assert.equal(await title().inputValue(),'Wooden study desk');
    await save().click();await pending();await eventually(()=>assert.equal(counts.get('/api/wants'),2));assert.equal(counts.get('/api/upload'),2,'retry reuses successful upload');
    const payload=JSON.parse(requests.filter(row=>row.path==='/api/wants').at(-1).body);assert.equal(payload.photo,'/uploads/wants/mock-reference.png');assert.equal(payload.description,'Please include a solid wooden top.');
    await release('/api/wants',{json:{want:{id:'mock-want',status:'PENDING_MODERATION'}}});
    const confirmation=dialog.getByRole('status').filter({hasText:'Your Want has been submitted for review.'});await confirmation.waitFor();
    assert.equal(await confirmation.innerText(),'Your Want has been submitted for review.');assert.equal(await page.evaluate(()=>window.wantChanges),1);
    const myWants=dialog.getByRole('link',{name:'View My Wants'});assert.equal(await myWants.getAttribute('href'),'/wants?tab=mine');await myWants.click();await dialog.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.navigations.at(-1)),'/wants?tab=mine');
    console.log('PASS submit: duplicate prevention, stable Save size, busy close guard, retained fields/file after upload and POST failure, cached upload retry, exact review confirmation, working My Wants action');

    await page.evaluate(()=>{history.replaceState(null,'','/wants');window.setTestAuth(false);});await trigger.click();await dialog.getByRole('heading',{name:'Sign in to post a Want'}).waitFor();assert.equal(await dialog.locator('form').count(),0);
    await dialog.getByRole('button',{name:'Sign in to continue'}).click();assert.equal(await page.evaluate(()=>window.loginCalls),1);
    const marker=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('joro:post-want:resume:v1')));assert.equal(marker.returnTo,'/wants');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});await page.evaluate(()=>window.setTestAuth(true));await title().waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('joro:post-want:resume:v1')),null);await fill();await page.evaluate(()=>window.setTestAuth(false));await save().click();
    await dialog.getByRole('alert').filter({hasText:'Your session has expired.'}).waitFor();assert.equal(await title().inputValue(),'Wooden study desk');
    await page.evaluate(()=>window.setTestAuth(true));await save().click();await release('/api/wants',{json:{want:{id:'restored-session',status:'PENDING_MODERATION'}}});await dialog.getByRole('button',{name:'Done',exact:true}).click();
    assert.deepEqual(errors,[]);console.log('PASS authentication: signed-out gate, resume marker and return, session-expiry input retention, successful retry after reauthentication; no browser errors');
  } catch (error) { console.error('Modal fixture state:',await page.locator('body').innerText()); console.error('Browser errors:',errors); throw error; }
  finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
