// Real login/recovery components and CSS; fixture-only HTTP. Never connects to SMTP or a database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import { chromium } from 'playwright-core';

const root = process.cwd();
// Real review/admin components; fixture-only moderation, no database access.
const entry="import React,{useState}from'react';import{createRoot}from'react-dom/client';import{Toaster}from'react-hot-toast';import{VerifiedOrderReviewSection}from'./components/user/VerifiedOrderReviewSection';import{ProductApprovedReviewsList}from'./components/user/ProductApprovedReviewsList';import AdminReviews from'./app/admin/reviews/page';function App(){const[stats,setStats]=useState(null);return location.pathname.startsWith('/admin')?<AdminReviews/>:<main className=\"mx-auto max-w-3xl p-4\"><output data-stats>{JSON.stringify(stats)}</output><ProductApprovedReviewsList postField={{productId:'product-a'}} onStats={setStats}/><VerifiedOrderReviewSection productId=\"product-a\"/></main>}createRoot(document.getElementById('root')).render(<><App/><Toaster/></>);";
const modules={"next-auth/react":"export const useSession=()=>({data:{user:{id:'customer-a',role:'customer'}},status:'authenticated'});","next/navigation":"export const useSearchParams=()=>new URLSearchParams(location.search);","@/hooks/useLoadingRouter":"const router={refresh:async()=>{throw new Error('fixture refresh failed')}};export const useLoadingRouter=()=>router;","@/context/CustomerAuthContext":"export const useCustomerAuth=()=>({openAuthModal:()=>{}});","next/image":"import React from'react';export default function Image({fill,unoptimized,priority,...props}){return <img {...props}/>}"};
const built = await esbuild.build({stdin:{contents:entry,loader:'tsx',resolveDir:root},bundle:true,write:false,outfile:'recovery.js',jsx:'automatic',platform:'browser',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'adapters',setup(builder){
  builder.onResolve({filter:/.*/},args=>args.path in modules?{path:args.path,namespace:'fixture'}:undefined);
  builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'tsx',resolveDir:root}));
}}]});
const config=loadConfig(path.join(root,'tailwind.config.ts'));
const globalCss=await postcss([tailwind({...config,content:[...config.content,{raw:entry,extension:'tsx'}]})]).process(fs.readFileSync('app/globals.css','utf8'),{from:path.join(root,'app/globals.css')});
const js=built.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css='html{--font-jakarta:Arial,Helvetica,sans-serif}'+globalCss.css+'\n'+built.outputFiles.find(file=>file.path.endsWith('.css')).text;
const server=http.createServer((req,res)=>{if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(js);}else if(req.url==='/test.css'){res.setHeader('Content-Type','text/css');res.end(css);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const executablePath=process.env.JORO_TEST_BROWSER||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file=>fs.existsSync(file));
let browser;
try {
  browser=await chromium.launch({executablePath,headless:true});
  const context=await browser.newContext({viewport:{width:390,height:900}});
  let review=null;let writes=0;const errors=[];
  await context.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.startsWith('/api/reviews/check/'))return route.fulfill({json:{eligible:true,reviewed:Boolean(review),review}});
    if(url.pathname==='/api/admin/reviews')return route.fulfill({json:{reviews:review?[{...review,id:1,scope:'product',name:'Fixture customer',email:'fixture@example.test',productId:'product-a',productName:'Fixture product',withdrawn:false,verifiedPurchase:true,createdAt:new Date().toISOString()}]:[]}});
    if(url.pathname==='/api/admin/reviews/1'){review.approved=req.postDataJSON().approved;return route.fulfill({json:{ok:true}});}
    if(url.pathname==='/api/reviews'&&req.method()!=='GET'){writes++;review={...req.postDataJSON(),approved:false,id:'1',name:'Fixture customer',imageUrl:null,createdAt:new Date().toISOString(),verifiedPurchase:true};return route.fulfill({json:{success:true,message:'Your review is awaiting moderation.'}});}
    if(url.pathname==='/api/reviews'){
      const rows=review?.approved&&url.searchParams.get('productId')==='product-a'?[review]:[];
      return route.fulfill({json:{reviews:rows,totalCount:rows.length,averageRating:rows[0]?.rating||0,breakdown:[5,4,3,2,1].map(star=>({star,count:rows.filter(r=>r.rating===star).length,percent:rows[0]?.rating===star?100:0}))}});
    }
    return route.fulfill({json:{}});
  });
  const customer=await context.newPage();customer.on('pageerror',error=>errors.push(error.message));
  await customer.goto(base+'/?orderId=order-a');
  await customer.locator('#verified-review-comment').fill('Excellent fixture purchase');
  await customer.getByRole('button',{name:'Submit review',exact:true}).click();
  await customer.getByText(/^Pending approval/).waitFor();
  await customer.getByText('No approved reviews yet',{exact:true}).waitFor();
  assert.equal(review.approved,false);assert.equal(writes,1);
  assert.equal(await customer.getByText('fixture refresh failed',{exact:true}).count(),0);
  const admin=await context.newPage();await admin.goto(base+'/admin/reviews');
  await admin.getByRole('button',{name:'Approve',exact:true}).click();
  await admin.getByRole('button',{name:'Unapprove',exact:true}).waitFor();
  await customer.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await customer.getByText('Your verified review is published.',{exact:true}).waitFor();
  await customer.getByText('Excellent fixture purchase',{exact:true}).waitFor();
  assert.deepEqual(JSON.parse(await customer.locator('[data-stats]').textContent()),{averageRating:5,totalCount:1});
  assert.match(await customer.getByLabel('Rating distribution').textContent(),/100%/);
  await customer.getByRole('button',{name:'Edit review',exact:true}).click();
  await customer.locator('#verified-review-comment').fill('Unsaved draft');
  await customer.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(await customer.locator('#verified-review-comment').inputValue(),'Unsaved draft');
  await customer.getByRole('button',{name:'Set rating to 4 of 5 stars',exact:true}).click();
  await customer.getByRole('button',{name:'Save review changes',exact:true}).click();
  await customer.getByText(/^Pending approval/).waitFor();
  await customer.getByText('No approved reviews yet',{exact:true}).waitFor();
  assert.equal(writes,2);assert.equal(review.rating,4);assert.equal(review.approved,false);
  await admin.reload();await admin.getByRole('button',{name:'Approve',exact:true}).click();
  await admin.getByRole('button',{name:'Unapprove',exact:true}).waitFor();
  // A customer who keeps the page open also refreshes on the visible-page timer.
  await customer.clock.install();await customer.clock.fastForward(30001);
  await customer.getByText('Your verified review is published.',{exact:true}).waitFor();
  assert.deepEqual(JSON.parse(await customer.locator('[data-stats]').textContent()),{averageRating:4,totalCount:1});
  await admin.getByRole('button',{name:'Unapprove',exact:true}).click();
  await admin.getByRole('button',{name:'Approve',exact:true}).waitFor();
  await customer.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await customer.getByText('No approved reviews yet',{exact:true}).waitFor();
  await customer.getByText(/^Pending approval/).waitFor();
  assert.deepEqual(JSON.parse(await customer.locator('[data-stats]').textContent()),{averageRating:0,totalCount:0});
  assert.deepEqual(errors,[]);
  console.log('PASS submit pending, admin approve, focus/timer refresh, public list/count/average/distribution, edit draft preservation, edited review pending, unapproval hidden, no false save error');
} finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
