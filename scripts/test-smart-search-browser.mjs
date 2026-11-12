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
const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{SearchBar}from'./components/SearchBar';import{LiveChat}from'./components/user/LiveChat';createRoot(document.getElementById('root')).render(<><header style={{maxWidth:700,margin:'auto',padding:12}}><SearchBar/></header><button id="outside">Outside</button><main style={{height:1000}}>Existing page</main><button aria-label="WhatsApp fixture" style={{position:'fixed',right:12,bottom:76,width:44,height:44}}>WA</button><nav style={{position:'fixed',bottom:0,height:64,width:'100%'}}>Mobile navigation</nav><LiveChat/></>);`,loader:'tsx',resolveDir:process.cwd()},outfile:'smart.js',write:false,bundle:true,jsx:'automatic',plugins:[{name:'adapters',setup(b){b.onResolve({filter:/.*/},a=>a.path in adapters?{path:a.path,namespace:'adapter'}:undefined);b.onLoad({filter:/.*/,namespace:'adapter'},a=>({contents:adapters[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const config=loadConfig(process.cwd()+'/tailwind.config.ts');
const css=(await postcss([tailwind({...config,content:['./components/SearchBar.tsx','./components/user/LiveChat.tsx']})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined})).css;
const server=http.createServer((req,res)=>{if(req.url==='/ui.js'){res.setHeader('Content-Type','application/javascript');res.end(built.outputFiles.find(f=>f.path.endsWith('.js')).text);}else if(req.url==='/ui.css'){res.setHeader('Content-Type','text/css');res.end(css);}else if(req.url==='/icon.png'){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync('public/icon.png'));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync),headless:true});
try {
  for(const width of [360,390,430,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    let started=false, unread=1;
    const items=[{id:'watch',kind:'products',title:'Fixture watch <script>',detail:'Watches',href:'/products/real-watch',image:'/icon.png',price:1200,originalPrice:1500},{id:'category',kind:'categories',title:'Watches',detail:'Category',href:'/categories/watches'}];
    await page.route('**/api/search/suggestions?*',async route=>{const q=new URL(route.request().url()).searchParams.get('q');requests.push(q);if(q==='slow')await new Promise(r=>setTimeout(r,600));await route.fulfill({status:q==='error'?503:200,json:{items:q==='none'?[]:q==='slow'?[{...items[0],title:'Obsolete result'}]:items}}).catch(()=>{});});
    await page.route('**/api/products?*',route=>route.fulfill({json:{products:[{_id:'watch',name:'Voice watch',price:1200,images:['/icon.png'],href:'/products/real-watch'}]}}));
    await page.route('**/api/live-chat',async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='start')started=true;if(body.action==='read')unread=0;await route.fulfill({json:{ok:true}});}else await route.fulfill({status:started?200:401,json:started?{messages:[{id:'reply',body:'Realistic test support reply',senderType:'ADMIN',createdAt:new Date().toISOString()}],unreadCount:unread,readThrough:new Date().toISOString(),available:false,status:'OPEN'}:{error:'Start a conversation'}});});
    await page.addInitScript(()=>{window.SpeechRecognition=class{start(){setTimeout(()=>{this.onresult?.({resultIndex:0,results:[[{transcript:'watch'}]]});this.onend?.();},25);}stop(){}};});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const input=page.getByRole('combobox',{name:'Search JORO marketplace'}), list=page.getByRole('listbox',{name:'Search suggestions'}), chat=page.getByRole('button',{name:'Live Chat',exact:true});
    assert.equal(await page.getByRole('dialog').count(),0);
    const box=await chat.boundingBox();assert.equal(box.width,48);assert.equal(box.height,48);
    if(width<768){const wa=await page.getByRole('button',{name:'WhatsApp fixture'}).boundingBox();assert.ok(box.y+box.height<=wa.y);}
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
    await page.getByRole('button',{name:'Close live chat'}).click();assert.equal(await page.getByRole('dialog').count(),0);
    unread=1;await page.reload();await chat.locator('[aria-hidden="true"]').filter({hasText:'1'}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);await chat.click();await page.getByText('Realistic test support reply').waitFor();await page.keyboard.press('Escape');assert.equal(await chat.getAttribute('aria-expanded'),'false');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: default/typed suggestions, price/image/slug/category, keyboard/Enter/Escape/outside/clear, stale response/debounce/error/empty, voice, compact chat/unread/minimize, no overflow or JS errors`);
    await page.close();
  }
} finally {await browser.close();await new Promise(r=>server.close(r));}
