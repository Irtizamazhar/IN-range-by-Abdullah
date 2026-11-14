// Actual components, mocked HTTP only. Real Prisma/authorization tests run separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import { chromium } from 'playwright-core';

const adapters = {
  'next/navigation': 'export const usePathname=()=>"/";export const useSearchParams=()=>new URLSearchParams();',
  '@/hooks/useLoadingRouter': 'export const useLoadingRouter=()=>({push:path=>{window.__destination=path}});',
  'next-auth/react': 'export const useSession=()=>({data:null});',
  'next/image': 'export default function Image({unoptimized,priority,sizes,...props}){return <img {...props}/>}',
  '@/components/ui/LoadingLink': 'export default function Link(props){return <a {...props}/>}',
};
const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{SearchBar}from'./components/SearchBar';import{LiveChat}from'./components/user/LiveChat';createRoot(document.getElementById('root')).render(<><header style={{maxWidth:700,margin:'auto',padding:12}}><SearchBar/></header><button id="outside">Outside</button><main style={{height:1000}}>Existing page</main><nav className="md:hidden" style={{position:'fixed',bottom:0,height:64,width:'100%'}}>Mobile navigation</nav><LiveChat/></>);`,loader:'tsx',resolveDir:process.cwd()},outfile:'smart.js',write:false,bundle:true,jsx:'automatic',plugins:[{name:'adapters',setup(b){b.onResolve({filter:/.*/},a=>a.path in adapters?{path:a.path,namespace:'adapter'}:undefined);b.onLoad({filter:/.*/,namespace:'adapter'},a=>({contents:adapters[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const config=loadConfig(process.cwd()+'/tailwind.config.ts');
const css=(await postcss([tailwind({...config,content:['./components/SearchBar.tsx','./components/user/LiveChat.tsx'],safelist:['md:hidden']})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined})).css+(built.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'');
const server=http.createServer((req,res)=>{if(req.url==='/ui.js'){res.setHeader('Content-Type','application/javascript');res.end(built.outputFiles.find(f=>f.path.endsWith('.js')).text);}else if(req.url==='/ui.css'){res.setHeader('Content-Type','text/css');res.end(css);}else if(req.url==='/icon.png'){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync('public/icon.png'));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync),headless:true});
let latestPage;
try {
  for(const width of [320,375,390,430,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],requests=[];
    latestPage=page;
    page.on('pageerror',e=>errors.push(e.message));
    let started=false, unread=1,failNextMessage=false,failRead=false;
    const sent=[];
    const messages=[{id:'reply',body:'Realistic test support reply',senderType:'ADMIN',createdAt:new Date().toISOString()}];
    const items=[{id:'watch',kind:'products',title:'Fixture watch <script>',detail:'Watches',href:'/products/real-watch',image:'/icon.png',price:1200,originalPrice:1500},{id:'category',kind:'categories',title:'Watches',detail:'Category',href:'/categories/watches'}];
    await page.route('**/api/search/suggestions?*',async route=>{const q=new URL(route.request().url()).searchParams.get('q');requests.push(q);if(q==='slow')await new Promise(r=>setTimeout(r,600));await route.fulfill({status:q==='error'?503:200,json:{items:q==='none'?[]:q==='slow'?[{...items[0],title:'Obsolete result'}]:items}}).catch(()=>{});});
    await page.route('**/api/products?*',route=>route.fulfill({json:{products:[{_id:'watch',name:'Voice watch',price:1200,images:['/icon.png'],href:'/products/real-watch'}]}}));
    await page.route('**/api/live-chat',async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='start')started=true;if(body.action==='read')unread=0;if(body.action==='message'){sent.push(body);await new Promise(r=>setTimeout(r,200));if(failNextMessage){failNextMessage=false;await route.fulfill({status:503,json:{error:'Fixture send failed. Please retry.'}});return;}messages.push({id:'message-'+sent.length,body:body.message,senderType:'GUEST',createdAt:new Date().toISOString()});}await route.fulfill({json:{ok:true}});}else await route.fulfill({status:failRead?503:started?200:401,json:failRead?{error:'Fixture connection interrupted'}:started?{messages,unreadCount:unread,readThrough:new Date().toISOString(),available:false,status:'OPEN'}:{error:'Start a conversation'}});});
    await page.addInitScript(()=>{window.SpeechRecognition=class{start(){setTimeout(()=>{this.onresult?.({resultIndex:0,results:[[{transcript:'watch'}]]});this.onend?.();},25);}stop(){}};});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const input=page.getByRole('combobox',{name:'Search JORO marketplace'}), list=page.getByRole('listbox',{name:'Search suggestions'}), chat=page.getByRole('button',{name:'Live Chat',exact:true});
    assert.equal(await page.getByRole('dialog').count(),0);
    const box=await chat.boundingBox();assert.equal(box.width,48);assert.equal(box.height,48);
    assert.equal(await page.locator('[data-floating-action="whatsapp"]').count(),0);assert.equal(await page.locator('[data-floating-action="live-chat"]').count(),1);
    assert.equal(900-box.y-box.height,width<768?76:24);
    await input.focus();await list.getByRole('option').first().waitFor();assert.equal(requests.length,1);
    assert.match(await list.innerText(),/1,200/);assert.equal(await list.locator('img').getAttribute('src'),'/icon.png');assert.equal(await list.locator('script').count(),0);
    await page.screenshot({path:`.release-prep/smart-search-focus-${width}.png`});
    const dropdown=await list.boundingBox();assert.ok(dropdown.x>=0&&dropdown.x+dropdown.width<=width);
    await input.press('ArrowDown');assert.equal(await list.getByRole('option').first().getAttribute('aria-selected'),'true');await input.press('Enter');assert.equal(await page.evaluate(()=>window.__destination),'/products/real-watch');
    await input.focus();await input.fill('watch');await page.waitForTimeout(350);await list.getByRole('option').first().waitFor();await list.getByRole('option').nth(1).click();assert.equal(await page.evaluate(()=>window.__destination),'/categories/watches');
    await input.fill('none');await page.getByText('No matching products. Try another name or category.').waitFor();await input.press('Enter');assert.equal(await page.evaluate(()=>window.__destination),'/search?q=none');
    await input.fill('slow');await page.waitForTimeout(300);await input.fill('watch');await page.waitForTimeout(750);assert.ok(!(await list.innerText()).includes('Obsolete result'));
    const count=requests.length;await input.fill('w');await input.fill('wa');await input.fill('wat');await input.fill('watch');await page.waitForTimeout(400);assert.equal(requests.length-count,1);
    await input.press('Escape');assert.equal(await list.count(),0);await input.focus();await input.fill('error');await page.getByText('Suggestions unavailable. Press Enter to search.').waitFor();
    await page.getByRole('button',{name:'Clear search'}).click();await list.getByRole('option').first().waitFor();assert.equal(await input.inputValue(),'');assert.equal(requests.filter(q=>q==='').length,1);
    await page.getByRole('button',{name:'Browse all products'}).click();assert.equal(await page.evaluate(()=>window.__destination),'/products');await input.blur();await input.focus();await list.getByRole('option').first().waitFor();
    await page.mouse.click(10,700);assert.equal(await list.count(),0);
    await page.getByRole('button',{name:'Start voice search',exact:true}).click();await page.getByRole('region',{name:'Voice search products'}).getByText('Voice watch').waitFor();
    await chat.click();await page.getByLabel('Name',{exact:true}).fill('Fixture Guest');await page.getByLabel('Email',{exact:true}).fill('guest@example.invalid');await page.getByRole('button',{name:'Start conversation'}).click();await page.getByText('Realistic test support reply').waitFor();
    const dialog=page.getByRole('dialog',{name:'Chat with JORO'}),send=dialog.getByRole('button',{name:'Send',exact:true}),message=dialog.getByLabel('Your message');
    assert.equal(await send.isDisabled(),true);assert.equal(await dialog.evaluate(e=>getComputedStyle(e).animationName),'none');
    const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=900);
    await message.fill('First line');await message.press('Shift+Enter');await message.pressSequentially('Second line');assert.equal(await message.inputValue(),'First line\nSecond line');await message.press('Enter');assert.equal(await send.isDisabled(),true);await dialog.getByRole('log').getByText('First line Second line',{exact:true}).waitFor();assert.equal(sent.at(-1).message,'First line\nSecond line');
    const before=sent.length;await message.fill('Duplicate guard');await message.evaluate(node=>{for(let i=0;i<2;i++)node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));});await dialog.getByRole('log').getByText('Duplicate guard',{exact:true}).waitFor();assert.equal(sent.length-before,1);
    failNextMessage=true;await message.fill('Retry the same draft');await send.click();await dialog.getByRole('alert').getByText('Fixture send failed. Please retry.').waitFor();assert.equal(await message.inputValue(),'Retry the same draft');const retryKey=sent.at(-1).clientKey;await send.click();await dialog.getByRole('log').getByText('Retry the same draft',{exact:true}).waitFor();assert.equal(sent.at(-1).clientKey,retryKey);
    if(width<768){await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>360});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.querySelector('#joro-live-chat').getBoundingClientRect().bottom<=360);const sendBounds=await send.boundingBox();assert.ok(sendBounds.y>=0&&sendBounds.y+sendBounds.height<=360);await page.screenshot({path:`.release-prep/premium-chat-keyboard-${width}.png`});await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});}
    await page.screenshot({path:`.release-prep/premium-chat-open-${width}.png`});
    if(width===320){
      messages.unshift(...Array.from({length:30},(_,i)=>({id:'history-'+i,body:'Historical support message '+i,senderType:'ADMIN',createdAt:new Date(Date.now()-3600000+i*1000).toISOString()})));
      await dialog.getByRole('button',{name:'Minimize live chat'}).click();await chat.click();const history=dialog.getByRole('log');await history.getByText('Historical support message 0',{exact:true}).waitFor({state:'attached'});
      await page.waitForFunction(()=>{const log=document.querySelector('[aria-label="Conversation messages"]');return log.scrollHeight-log.scrollTop-log.clientHeight<2;});
      await history.evaluate(node=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll'));});messages.push({id:'incoming-new',body:'New admin reply while reading history',senderType:'ADMIN',createdAt:new Date().toISOString()});await history.getByText('New admin reply while reading history',{exact:true}).waitFor({state:'attached',timeout:25000});assert.ok(await history.evaluate(node=>node.scrollTop<10));
      await message.fill('Back to latest');await send.click();await history.getByText('Back to latest',{exact:true}).waitFor({state:'attached'});await page.waitForFunction(()=>{const log=document.querySelector('[aria-label="Conversation messages"]');return log.scrollHeight-log.scrollTop-log.clientHeight<2;});
    }
    await dialog.getByRole('button',{name:'Minimize live chat'}).click();assert.equal(await page.getByRole('dialog').count(),0);await chat.click();await page.getByText('Realistic test support reply').waitFor();
    failRead=true;await dialog.getByRole('button',{name:'Close live chat'}).click();await chat.click();await dialog.getByRole('alert').getByText(/Connection interrupted/).waitFor();failRead=false;await dialog.getByRole('button',{name:'Reconnect'}).click();await dialog.getByRole('alert').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Close live chat'}).click();assert.equal(await page.getByRole('dialog').count(),0);
    unread=1;await page.reload();await chat.locator('[aria-hidden="true"]').filter({hasText:'1'}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);await chat.click();await page.getByText('Realistic test support reply').waitFor();await page.keyboard.press('Escape');assert.equal(await chat.getAttribute('aria-expanded'),'false');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: search regression, one 48px launcher in former WhatsApp position, no floating WhatsApp, panel bounds/keyboard/reduced motion, Enter/Shift+Enter, duplicate guard/retry, errors/reconnect, unread/minimize/refresh, no overflow or JS errors`);
    await page.close();
  }
} catch(error) { if(latestPage&&!latestPage.isClosed())await latestPage.screenshot({path:'.release-prep/premium-chat-browser-failure.png'});throw error; } finally {await browser.close();await new Promise(r=>server.close(r));}
