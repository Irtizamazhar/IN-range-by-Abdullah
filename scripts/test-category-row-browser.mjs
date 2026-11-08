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
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {CategoryAutoScroll} from './components/user/CategoryAutoScroll'; const categories=Array.from({length:12},(_,i)=>({id:i,name:'Category name '+i,slug:'category-'+i,image:''})); createRoot(document.getElementById('root')).render(<main style={{maxWidth:1280,margin:'auto',padding:16}}><CategoryAutoScroll categories={categories}/></main>);`;
const built = await esbuild.build({ stdin:{ contents:entry, loader:'tsx', resolveDir:process.cwd() }, bundle:true, write:false, jsx:'automatic', plugins:[{ name:'adapters', setup(b){ b.onResolve({filter:/.*/},a=>a.path in adapters?{path:a.path,namespace:'adapter'}:undefined); b.onLoad({filter:/.*/,namespace:'adapter'},a=>({contents:adapters[a.path],resolveDir:process.cwd(),loader:'tsx'})); } }] });
const config=loadConfig(process.cwd()+'/tailwind.config.ts');
const css=await postcss([tailwind({...config,content:['./components/user/CategoryAutoScroll.tsx']})]).process('@tailwind base; @tailwind components; @tailwind utilities;',{from:undefined});
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({executablePath,headless:true});
try {
  for(const width of [390,768,1024,1440,1920]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.setContent('<html><head><style>'+css.css+'</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({content:built.outputFiles[0].text});
    await page.waitForSelector('[role="listitem"]');
    const result=await page.evaluate(()=>{const row=document.querySelector('[role="list"]'); const cards=[...document.querySelectorAll('[role="listitem"]')].map(e=>e.getBoundingClientRect()); return {oneRow:new Set(cards.map(r=>r.top)).size===1,overflow:document.documentElement.scrollWidth>innerWidth,count:cards.filter(r=>r.right<=row.getBoundingClientRect().right).length,overlap:cards.some((r,i)=>i>0&&r.left<cards[i-1].right)};});
    assert.equal(result.oneRow,true);assert.equal(result.overflow,false);assert.equal(result.overlap,false);
    console.log(JSON.stringify({width,...result,fixture:true})); await page.close();
  }
} finally { await browser.close(); }
