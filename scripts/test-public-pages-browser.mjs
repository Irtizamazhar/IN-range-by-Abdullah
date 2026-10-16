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
const entry="\nimport React from 'react';import {createRoot} from 'react-dom/client';import About from './app/(user)/about/page';import Terms from './app/(user)/terms-and-conditions/page';import {Footer} from './components/user/Footer';import {AnnouncementBar} from './components/user/AnnouncementBar';import {HeroSection} from './components/user/HeroSection';\ncreateRoot(document.getElementById('root')).render(<><AnnouncementBar/><header className=\"sticky top-10\" data-nav>JORO navigation</header><main>{location.pathname==='/terms-and-conditions'?<Terms/>:location.pathname==='/about'?<About/>:<HeroSection sellNowHref=\"/sell\"/>}</main><Footer settings={{shopName:'JORO',whatsappNumber:''}}/></>);\n";
async function run(){
  const navigation=fs.readFileSync(path.join(root,'lib/footer-navigation.ts'),'utf8');
  const ids=[...navigation.matchAll(/id: "([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length,'footer keys must be unique');
  for(const [,href] of navigation.matchAll(/href: "([^"]+)"/g)){assert.ok(['app/(user)','app'].some(base=>['page.tsx','route.ts'].some(file=>fs.existsSync(path.join(root,base,href,file)))),'Implemented footer destination: '+href)}
  assert.match(fs.readFileSync(path.join(root,'app/(user)/joro-connect/route.ts'),'utf8'),/wants/);

  const modules = {
    'next/navigation': `export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>location.pathname; export const useRouter=()=>({push:async url=>{window.__navigation=url},replace:async url=>{window.__navigation=url},refresh:async()=>{}});`,
    '@/hooks/useLoadingRouter': `export {useRouter as useLoadingRouter} from 'next/navigation';`,
    '@/components/ui/LoadingLink': `import React from 'react';export function LoadingLink({children,...props}){return <a {...props}>{children}</a>};export default LoadingLink;`,
    '@/components/user/LogoMark': `import React from 'react';export const LogoMark=({className})=><span className={className}>JORO</span>;`,
    '@/context/PostWantContext': `export const usePostWant=()=>({openPostWant:()=>{window.__wantOpens=(window.__wantOpens||0)+1}});`,
    'next/image': `import React from 'react';export default function Image({src,fill,priority,unoptimized,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'}:props.style}/>;}`,
  };
  const built = await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: root }, bundle: true, write: false, outfile: 'ux.js', loader: { '.png': 'dataurl' }, jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'adapters', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in modules ? { path: args.path, namespace: 'adapter' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'adapter' }, args => ({ contents: modules[args.path], loader: 'tsx', resolveDir: root }));
  } }] });
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  const styles = await postcss([tailwind({ ...config, content: [...config.content, { raw: entry, extension: 'tsx' }] })]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
  const js = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = styles.css + '\n' + (built.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');

const server=http.createServer((req,res)=>{if(req.url==='/ux.js'){res.setHeader('Content-Type','application/javascript');res.end(js)}else if(req.url==='/ux.css'){res.setHeader('Content-Type','text/css');res.end(css)}else if(req.url.startsWith('/branding/')||req.url==='/logo.png'){const file=path.join(root,'public',req.url);if(fs.existsSync(file)){res.end(fs.readFileSync(file))}else {res.statusCode=404;res.end()}}else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ux.css"></head><body><div id="root"></div><script src="/ux.js"></script></body></html>')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const executablePath=process.env.JORO_TEST_BROWSER||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(f=>fs.existsSync(f));let browser;
try{browser=await chromium.launch({executablePath,headless:true});for(const width of [320,360,375,768,1280]){const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(base+'/about');await page.getByRole('heading',{name:'About JORO',exact:true}).waitFor();assert.equal(await page.getByText('Founder & Owner, JORO',{exact:true}).count(),2);assert.equal(await page.getByRole('heading',{name:'Hamid Khan',exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'Irtiza',exact:true}).count(),1);assert.equal(await page.locator('article img[src="/logo.png"]').evaluate(img=>img.complete&&img.naturalWidth>0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'About overflow at '+width);
await page.getByRole('button',{name:'Request a Want',exact:true}).first().click();assert.equal(await page.evaluate(()=>window.__wantOpens),1);
assert.equal(await page.getByRole('link',{name:'Explore Partnership Opportunities'}).getAttribute('href'),'mailto:admin@joro.pk');
const summaries=page.locator('footer summary');for(let i=0;i<await summaries.count();i++){if(await summaries.nth(i).isVisible())await summaries.nth(i).click()}
assert.ok(await page.locator('footer a[href="/account/help"]').count()>0);assert.ok(await page.locator('footer a[href="/joro-connect"]').count()>0);assert.equal(await page.locator('footer a[href="/grow"],footer a[href="/privacy-policy"]').count(),0);assert.ok(await page.locator('footer [aria-disabled="true"]').count()>=2);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Footer overflow at '+width);
await page.goto(base+'/');await page.getByText('Na Mile?',{exact:false}).waitFor();assert.equal(await page.getByRole('region',{name:'JORO marketplace highlights'}).count(),1);assert.equal(await page.locator('[aria-label="JORO marketplace highlights"]').evaluate(el=>el.getBoundingClientRect().height),32);assert.equal(await page.locator('[data-nav]').evaluate(el=>getComputedStyle(el).top),'32px');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Home overflow at '+width);
await page.goto(base+'/terms-and-conditions');await page.getByRole('heading',{name:'Official JORO terms pending approval'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.goBack();await page.goForward();await page.getByRole('heading',{name:'Official JORO terms pending approval'}).waitFor();assert.deepEqual(errors,[]);console.log('PASS '+width+'px: About founders/logo, request action, partnership mailto, footer destinations, compact bar, responsive layouts, history');await page.close()}}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}}
run().catch(e=>{console.error(e);process.exitCode=1});
