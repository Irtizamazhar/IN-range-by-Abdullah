/** Isolated real React UI with HTTP fixtures. No real geography claims, database writes or live provider calls. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import {chromium} from 'playwright-core';
const root=process.cwd();
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Vendor from './app/vendor/dashboard/services/page';import{ServiceListings}from'./components/admin/ServiceListings';import{ServiceLocationFilter}from'./components/user/services/ServiceLocationFilter';const screen=new URLSearchParams(location.search).get('screen');createRoot(document.getElementById('root')).render(screen==='admin'?<main className="mx-auto max-w-7xl p-4"><ServiceListings/></main>:screen==='filter'?<form><ServiceLocationFilter/></form>:<Vendor/>);`;
const adapters={
 'next/image':`import React from'react';export default function Image({priority,unoptimized,...p}){return <img {...p}/>}`,
 '@/components/support/NeedHelpButton':`import React from'react';export const NeedHelpButton=()=> <button type="button">Need Help</button>;`,
 '@/components/ui/LoadingLink':`import React from'react';export default function Link(p){return <a {...p}/>}`,
 '@/components/ui/LoadingButton':`import React from'react';export const LoadingButton=({loadingLabel,...p})=><button {...p}/>;`,
 '@/components/ui/LoadingForm':`import React from'react';export const LoadingForm=p=><form {...p}/>;`,
 '@/components/ui/PageSkeleton':`import React from'react';export const PageSkeleton=()=> <p>Loading…</p>;`,
};
const built=await esbuild.build({stdin:{contents:entry,loader:'tsx',resolveDir:root},bundle:true,write:false,outfile:'services.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'test-adapters',setup(b){b.onResolve({filter:/.*/},a=>a.path in adapters?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:adapters[a.path],loader:'tsx',resolveDir:root}))}}]});
const config=loadConfig(path.join(root,'tailwind.config.ts'));
const css=(await postcss([tailwind(config)]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')})).css;
const catalog=[{id:'catalog-ui',name:'UI fixture service',category:'UI fixture category',description:'Fixture scope',defaultPrice:'2500',priceType:'STARTING_FROM',active:true}];
let services=[];const vendors=[{id:'vendor-ui',shopName:'UI fixture provider',city:'UI fixture city'}];
const place=(id,name,kind='city',parent)=>({id,name,label:name+' (offline UI fixture)',kind,token:'offline-test-fixture-token',proof:{version:2,providerId:'fixture-provider-'+id,sourceId:id,boundaryIds:['osm:r:600'],cityNames:parent?[]:[name.toLowerCase()],...(parent?{citySourceId:parent}:{}),method:'source-hierarchy'}});
const cities=[place('osm:n:10001','Lahore'),place('osm:n:10002','Islamabad')];
const areas=[place('osm:r:20001','Lahore test area','suburb',cities[0].id),place('osm:r:20002','Islamabad test area','suburb',cities[1].id)];
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');let body={};if(req.method==='POST'||req.method==='PATCH'){let raw='';for await(const chunk of req)raw+=chunk;body=JSON.parse(raw)}
 if(url.pathname==='/services.js'){res.setHeader('Content-Type','application/javascript');return res.end(built.outputFiles.find(f=>f.path.endsWith('.js')).text)}
 if(url.pathname==='/styles.css'){res.setHeader('Content-Type','text/css');return res.end(css)}
 if(url.pathname==='/api/services/locations'){
  if(url.searchParams.get('q').includes('offline'))return json(res,{error:'Provider unavailable. No fabricated fallback.'},503);
  const city=url.searchParams.get('city')?JSON.parse(url.searchParams.get('city')):null;
  return json(res,{locations:city?[areas[cities.findIndex(c=>c.id===city.id)]]:cities.filter(c=>c.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase()))});
 }
 if(url.pathname==='/api/services/bookings')return json(res,{bookings:[],total:0});
 if(url.pathname==='/api/admin/services/catalog'){catalog.push({...body,id:'catalog-created'});return json(res,{catalog:catalog.at(-1)})}
 if(url.pathname==='/api/vendor/services'){
  if(req.method==='POST'){
   if(body.action==='availability'){services.find(s=>s.id===body.id).active=body.active;return json(res,{success:true})}
   const c=catalog.find(c=>c.id===body.catalogId);const listing={...body,id:body.id||'listing-ui',name:c.name,type:c.category,moderationStatus:'PENDING_APPROVAL',moderationReason:null,updatedAt:new Date().toISOString(),submittedAt:new Date().toISOString(),vendor:{...vendors[0],status:'approved'},catalog:c};services=services.filter(s=>s.id!==listing.id).concat(listing);return json(res,{service:listing})
  }
  return json(res,{services,catalog,products:[],addons:[],bookingCount:0});
 }
 if(url.pathname==='/api/admin/services'){
  if(req.method==='PATCH'){const s=services.find(s=>s.id===body.id);s.moderationStatus=body.action==='approve'?'APPROVED':'REJECTED';s.moderationReason=body.reason;return json(res,{service:s})}
  return json(res,{services:services.filter(s=>!url.searchParams.get('status')||s.moderationStatus===url.searchParams.get('status')),catalog,vendors,total:services.length,stats:[],locationRequests:[]});
 }
 res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/services.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const executable=process.env.SERVICES_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let browser;
try{
 browser=await chromium.launch({executablePath:executable,headless:true});const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=`http://127.0.0.1:${server.address().port}`;
 await page.goto(base+'/?screen=admin');await page.getByRole('button',{name:'Service Catalog',exact:true}).click();await page.getByRole('button',{name:'+ Create master service'}).click();await page.getByLabel('Service name',{exact:true}).fill('New catalog fixture');await page.getByLabel('Category',{exact:true}).fill('UI fixture category');await page.getByLabel('Description',{exact:true}).fill('Catalog creation fixture');await page.getByLabel('Default price (PKR)').fill('4500');await page.getByRole('button',{name:'Save catalog service'}).click();await page.getByRole('cell').filter({hasText:'New catalog fixture'}).waitFor();assert.equal(catalog.length,2);console.log('Admin catalog creation UI PASS');
 await page.goto(base);await page.getByRole('button',{name:'+ Add New Service'}).click();await page.getByLabel('Select service',{exact:true}).selectOption('catalog-ui');assert.equal(await page.getByLabel('Your price (PKR)').inputValue(),'2500');await page.getByLabel('Your price (PKR)').fill('3100');await page.getByLabel('Cancellation and scheduling terms').fill('UI fixture cancellation terms');
 for(let i=0;i<2;i++){await page.getByLabel('Add coverage city',{exact:true}).fill(cities[i].name);await page.getByRole('button',{name:new RegExp(cities[i].name+'.*city')}).click();await page.getByLabel('Add area in '+cities[i].name,{exact:true}).fill('area');await page.getByRole('button',{name:new RegExp(areas[i].name+'.*suburb')}).click()}
 for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(50);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Vendor form overflow ${width}`)}
 await page.screenshot({path:path.join(os.tmpdir(),'joro-services-vendor-desktop.png'),fullPage:true});await page.getByRole('button',{name:'Submit for Approval',exact:true}).click();await page.getByRole('status').filter({hasText:'Pending Admin Approval'}).waitFor();assert.equal(services[0].price,3100);assert.equal(services[0].coverage.length,2);assert.equal(services[0].coverage[0].areas[0].id,areas[0].id);assert.equal(services[0].coverage[1].areas[0].id,areas[1].id);console.log('Vendor default/custom pricing, multiple cities and city-specific areas, pending submission PASS');
 await page.goto(base+'/?screen=admin');await page.getByRole('button',{name:'Pending Approvals',exact:true}).click();await page.getByRole('button',{name:'approve',exact:true}).click();await page.getByLabel('Reason / investigation').fill('Reviewed UI fixture details');await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(services[0].moderationStatus,'APPROVED');
 await page.getByRole('button',{name:'All Vendor Services',exact:true}).click();await page.getByText('View full details',{exact:true}).click();for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Admin overflow ${width}`)}console.log('Admin pending review, approval, full details and responsive layouts PASS');
 await page.goto(base+'/?screen=filter');await page.getByLabel('Search city',{exact:true}).fill('Lahore');await page.getByRole('button',{name:/Lahore.*city/}).click();await page.getByLabel('Search area in Lahore',{exact:true}).fill('area');await page.getByRole('button',{name:/Lahore test area.*suburb/}).click();assert.equal(await page.locator('[name=cityId]').inputValue(),cities[0].id);assert.equal(await page.locator('[name=areaId]').inputValue(),areas[0].id);await page.getByLabel('Search city',{exact:true}).fill('offline');await page.getByText('Provider unavailable. No fabricated fallback.',{exact:true}).waitFor();assert.equal(await page.locator('[name=areaId]').inputValue(),areas[0].id);console.log('Customer location filters, provider errors and saved selection preservation PASS');assert.deepEqual(errors,[]);
 console.log('All isolated Services browser checks passed. Real Geoapify geography NOT tested.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
