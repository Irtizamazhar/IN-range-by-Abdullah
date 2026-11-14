import fs from 'node:fs';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import { chromium } from 'playwright-core';
const adapters = {
  '@/components/ui/LoadingLink': 'export default function Link({children,...props}) { return <a {...props}>{children}</a> }',
  'next/image': 'export default function Image(){return null}',
};
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {CategoryAutoScroll} from './components/user/CategoryAutoScroll'; const categories=Array.from({length:12},(_,i)=>({id:i,name:'Category name '+i,slug:'category-'+i,image:''})); const root=createRoot(document.getElementById('root')); window.setCategoryCount=count=>root.render(<main style={{maxWidth:1280,margin:'auto',padding:16}}><CategoryAutoScroll categories={categories.slice(0,count)}/></main>); window.setCategoryCount(12);`;
const built = await esbuild.build({ stdin:{ contents:entry, loader:'tsx', resolveDir:process.cwd() }, outfile:'category.js', bundle:true, write:false, jsx:'automatic', plugins:[{ name:'adapters', setup(b){ b.onResolve({filter:/.*/},a=>a.path in adapters?{path:a.path,namespace:'adapter'}:undefined); b.onLoad({filter:/.*/,namespace:'adapter'},a=>({contents:adapters[a.path],resolveDir:process.cwd(),loader:'tsx'})); } }] });
const config=loadConfig(process.cwd()+'/tailwind.config.ts');
const css=await postcss([tailwind({...config,content:['./components/user/CategoryAutoScroll.tsx']})]).process('@tailwind base; @tailwind components; @tailwind utilities;',{from:undefined});
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({executablePath,headless:true});
try {
  for(const width of [390,768,1024,1440,1920]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    await page.setContent('<html><head><style>'+css.css+'\n'+(built.outputFiles.find(f=>f.path.endsWith('.css'))?.text || '')+'</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({content:built.outputFiles.find(f=>f.path.endsWith('.js')).text});
    await page.waitForSelector('[role="listitem"]');
    const result=await page.evaluate(()=>{const row=document.querySelector('[role="list"]'); const cards=[...document.querySelectorAll('[role="listitem"]')].filter(e=>e.getClientRects().length>0).map(e=>e.getBoundingClientRect()); return {oneRow:new Set(cards.map(r=>r.top)).size===1,overflow:document.documentElement.scrollWidth>innerWidth,count:cards.filter(r=>r.right<=row.getBoundingClientRect().right).length,rendered:cards.length,overlap:cards.some((r,i)=>i>0&&r.left<cards[i-1].right)};});
    assert.equal(result.oneRow,true);assert.equal(result.overflow,false);assert.equal(result.overlap,false);
    assert.equal(result.rendered,10);
    if(width>=1440)assert.equal(result.count,10);
    assert.equal(await page.locator('[role="listitem"] a').count(),10);
    assert.equal(await page.locator('[role="listitem"] a').first().getAttribute('href'),'/categories/category-0');
    assert.equal(await page.locator('[role="listitem"] a > span:first-child').first().innerText(),'C');
    assert.equal(await page.locator('[role="listitem"] a > span:first-child').first().evaluate(e=>getComputedStyle(e).animationName),'none');
    if(width<1440){const scrolled=await page.locator('[role="list"]').evaluate(e=>{e.scrollLeft=e.scrollWidth;return e.scrollLeft>0;});assert.equal(scrolled,true);}
    if(width>=1440){await page.evaluate(()=>window.setCategoryCount(4));await page.waitForFunction(()=>document.querySelectorAll('[role="listitem"]').length===4);assert.ok((await page.locator('[role="list"]').boundingBox()).width<=448);}
    console.log(JSON.stringify({width,...result,fixture:true})); await page.close();
  }
} finally { await browser.close(); }
