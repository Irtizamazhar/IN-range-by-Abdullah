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
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{LoginExperience}from'./components/auth/LoginExperience';import{AuthModal}from'./components/user/AuthModal';
function App(){const[open,setOpen]=useState(true);return location.search.includes('popup')?<><button onClick={()=>setOpen(true)}>Account</button><AuthModal isOpen={open} onClose={()=>setOpen(false)}/></>:<LoginExperience initialRole="customer" initialMode="signin" googleEnabled/>}createRoot(document.getElementById('root')).render(<App/>);`;
const modules = {
  'next-auth/react': `export const useSession=()=>({data:null,status:'unauthenticated',update:async()=>{}});export const signIn=async()=>({ok:true});export const signOut=async()=>{};export const getSession=async()=>null;`,
  'next/navigation': `export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:async()=>{},replace:async()=>{},refresh:()=>{}});`,
  '@/hooks/useLoadingRouter': `export {useRouter as useLoadingRouter} from 'next/navigation';`,
  '@/components/ui/LoadingLink': `import React from'react';export default function Link({onNavigateComplete,children,...props}){return <a {...props}>{children}</a>}`,
  '@/components/user/LogoMark': `import React from'react';export const LogoMark=({className})=><span className={className}>JORO</span>;`,
  '@/components/auth/AuthBrandPanel': `import React from'react';export const AuthBrandPanel=({className})=><aside className={className}/>;`,
};
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
  const page=await browser.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const reviewDir=path.join(root,'.next','password-recovery-review');fs.mkdirSync(reviewDir,{recursive:true});
  await page.route('**/api/vendor/me',route=>route.fulfill({status:401,json:{}}));
  let requests=0, resets=0, failRequest=false, failReset=false;
  await page.route('**/api/customer/password-recovery',async route=>{
    const input=route.request().postDataJSON();
    if(input.action==='request'){if(failRequest)return route.fulfill({status:503,json:{error:'Password recovery email is unavailable.'}});requests++;return route.fulfill({json:{ok:true,challengeId:'11111111-1111-4111-8111-111111111111',retryAfter:60,message:'If this email is eligible, a code will arrive shortly.'}});}
    if(input.action==='verify')return route.fulfill(input.code==='123456'?{json:{ok:true,authorization:'a'.repeat(64)}}:{status:400,json:{error:'This code is invalid or expired.'}});
    if(failReset)return route.fulfill({status:503,json:{error:'Could not reset password.'}});resets++;await new Promise(resolve=>setTimeout(resolve,150));return route.fulfill({json:{ok:true}});
  });
  const paste=async(text)=>page.getByRole('textbox',{name:'Digit 1',exact:true}).evaluate((node,value)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',value);node.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData}));},text);
  const checkLayout=async()=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no document overflow');
    assert.equal(await page.getByRole('dialog',{name:/Reset Password|Enter OTP|Set New Password|Password Updated!/}).evaluate(node=>node.scrollWidth<=node.clientWidth),true,'no card overflow');
  };
  for(const width of [320,360,375,390,414,430,768,1280]){
    await page.setViewportSize({width,height:850});await page.goto(base);
    const trigger=page.getByRole('button',{name:'Forgot password?',exact:true});await trigger.click();
    await page.getByRole('heading',{name:'Reset Password',exact:true}).waitFor();await checkLayout();
    if(width===390)await page.screenshot({path:path.join(reviewDir,'email-mobile.png')});
    await page.keyboard.press('Escape');await trigger.waitFor();assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'focus restored');
    await trigger.click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await trigger.click();
    await page.getByRole('button',{name:'Send OTP',exact:true}).click();await page.getByRole('alert').filter({hasText:'valid email'}).waitFor();
    await page.getByLabel('Email Address',{exact:true}).fill('recovery@example.test');await page.getByRole('button',{name:'Send OTP',exact:true}).click();
    await page.getByRole('heading',{name:'Enter OTP',exact:true}).waitFor();await checkLayout();
    if(width===390)await page.screenshot({path:path.join(reviewDir,'otp-mobile.png')});
    assert.equal(await page.getByText('recovery@example.test',{exact:true}).count(),0,'email is masked');
    assert.match(await page.getByText(/Resend OTP in/).textContent(),/0[01]:\d\d/);
    await page.getByLabel('Digit 1',{exact:true}).fill('1');assert.equal(await page.getByLabel('Digit 2',{exact:true}).evaluate(node=>node===document.activeElement),true);
    await page.getByLabel('Digit 2',{exact:true}).press('Backspace');assert.equal(await page.getByLabel('Digit 1',{exact:true}).inputValue(),'');
    await paste('000000');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('alert').filter({hasText:'invalid or expired'}).waitFor();
    await paste('123456');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('heading',{name:'Set New Password',exact:true}).waitFor();await checkLayout();
    if(width===390||width===1280)await page.screenshot({path:path.join(reviewDir,`password-${width}.png`)});
    await page.getByLabel('New Password',{exact:true}).fill('new-password');await page.getByLabel('Confirm New Password',{exact:true}).fill('mismatch');await page.getByRole('button',{name:'Reset Password',exact:true}).click();await page.getByRole('alert').filter({hasText:'do not match'}).waitFor();
    await page.getByLabel('Confirm New Password',{exact:true}).fill('new-password');
    assert.equal(await page.getByLabel('New Password',{exact:true}).getAttribute('type'),'password');
    await page.getByRole('dialog',{name:'Set New Password',exact:true}).getByRole('button',{name:'Show password',exact:true}).first().click();assert.equal(await page.getByLabel('New Password',{exact:true}).getAttribute('type'),'text');
    await page.getByRole('button',{name:'Reset Password',exact:true}).click();await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'Password Updated!',exact:true}).waitFor();await checkLayout();
    if(width===390)await page.screenshot({path:path.join(reviewDir,'success-mobile.png')});
    await page.getByRole('button',{name:'Go to Sign In',exact:true}).click();
    assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
    console.log(`PASS ${width}px: all recovery steps, validation, paste, keyboard, focus and overflow`);
  }
  // Existing popup must remain open after closing recovery; Escape must affect only the top dialog.
  await page.goto(base+'/?popup');await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
  await page.getByRole('heading',{name:'Reset Password',exact:true}).waitFor();await page.keyboard.press('Escape');
  await page.getByRole('heading',{name:'Welcome Back!',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Forgot password?',exact:true}).evaluate(node=>node===document.activeElement),true);
  assert.equal(requests,8);assert.equal(resets,8);assert.deepEqual(errors,[]);
  await page.goto(base);await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
  await page.getByLabel('Email Address',{exact:true}).fill('recovery@example.test');await page.getByRole('button',{name:'Send OTP',exact:true}).click();
  await page.getByRole('heading',{name:'Enter OTP',exact:true}).waitFor();
  await page.clock.install();await page.clock.fastForward(61000);
  await page.getByRole('button',{name:'Resend OTP',exact:true}).click();assert.equal(requests,9+1);
  await paste('123456');await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('heading',{name:'Set New Password',exact:true}).waitFor();await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('heading',{name:'Reset Password',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).focus();await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button',{name:'Close password recovery',exact:true}).evaluate(node=>node===document.activeElement),true,'Tab wraps inside recovery');
  await page.setViewportSize({width:320,height:400});await checkLayout();
  await page.getByRole('button',{name:'Cancel',exact:true}).scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  console.log('PASS resend countdown, Back after verification, focus trap and short viewport');
  await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
  await page.getByLabel('Email Address',{exact:true}).fill('recovery@example.test');
  failRequest=true;await page.getByRole('button',{name:'Send OTP',exact:true}).click();await page.getByRole('alert').filter({hasText:'email is unavailable'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Enter OTP',exact:true}).count(),0);
  failRequest=false;await page.getByRole('button',{name:'Send OTP',exact:true}).click();await page.getByRole('heading',{name:'Enter OTP',exact:true}).waitFor();
  await paste('123456');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('heading',{name:'Set New Password',exact:true}).waitFor();
  await page.getByLabel('New Password',{exact:true}).fill('new-password');await page.getByLabel('Confirm New Password',{exact:true}).fill('new-password');
  failReset=true;await page.getByRole('button',{name:'Reset Password',exact:true}).click();await page.getByRole('alert').filter({hasText:'Could not reset'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Password Updated!',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS popup integration, provider/reset failure feedback; no browser errors; fixture HTTP only');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
