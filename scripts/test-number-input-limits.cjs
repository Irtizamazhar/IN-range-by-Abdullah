const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("playwright-core");

async function pasteReplacement(input, text) {
  await input.focus();
  await input.evaluate((element, text) => {
    element.setSelectionRange(0, element.value.length);
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles:true, cancelable:true, clipboardData }));
  }, text);
}

async function main() {
  const bundle=await build({
    stdin:{
      contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {CnicInput} from './components/ui/CnicInput';
        function Preview(){const [value,setValue]=useState('');return <label>CNIC Number<CnicInput value={value} onValueChange={setValue} maxLength={200}/></label>}createRoot(document.getElementById('root')).render(<Preview/>);`,
      resolveDir:process.cwd(),loader:"tsx",
    },
    bundle:true,write:false,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"'},
  });
  const browser=await chromium.launch({
    executablePath:process.env.PLAYWRIGHT_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,
  });
  try {
    const page=await browser.newPage();
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.route("http://number-preview.test/**",route=>{
      if(new URL(route.request().url()).pathname==="/app.js") return route.fulfill({contentType:"text/javascript",body:bundle.outputFiles[0].text});
      return route.fulfill({contentType:"text/html",body:'<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>'});
    });
    await page.goto("http://number-preview.test/");
    const cnic=page.getByLabel("CNIC Number",{exact:true});await cnic.waitFor();
    assert.equal(await cnic.getAttribute("maxlength"),"15");
    await cnic.pressSequentially("123451234567198765");
    assert.equal(await cnic.inputValue(),"12345-1234567-1");
    await cnic.evaluate(el=>el.setSelectionRange(3,3));await cnic.pressSequentially("9");
    assert.equal(await cnic.inputValue(),"12345-1234567-1","Full CNIC cannot lose its last digit to a middle insertion");
    await cnic.evaluate(el=>el.setSelectionRange(2,3));await cnic.pressSequentially("9");
    assert.equal(await cnic.inputValue(),"12945-1234567-1");
    for(const text of ["123451234567198765","  12345 1234567 1  ","12345-1234567-1"]) {
      await pasteReplacement(cnic,text);assert.equal(await cnic.inputValue(),"12345-1234567-1");
    }
    await pasteReplacement(cnic,"CNIC invalid pasted content that is too long");
    assert.equal(await cnic.inputValue(),"12345-1234567-1");
    await cnic.press("End");await cnic.press("Backspace");await cnic.pressSequentially("98");
    assert.equal(await cnic.inputValue(),"12345-1234567-9");
    await cnic.press("Control+A");await cnic.press("Backspace");assert.equal(await cnic.inputValue(),"");
    console.log("PASS CNIC: 13-digit cap, extra/middle insertion blocked, selection replacement, paste, deletion and clearing");

    await page.route("**/api/vendor/me",route=>route.fulfill({status:401,json:{error:"Not signed in"}}));
    await page.goto((process.env.NUMBER_TEST_URL || "http://localhost:3000")+"/login?role=vendor&mode=signup",{waitUntil:"domcontentloaded",timeout:90000});
    const phone=page.getByLabel("Mobile Number",{exact:true});await phone.waitFor({timeout:60000});
    for(const [raw,expected,max] of [
      ["03241234567","0324-1234567",12],
      ["+923241234567","+92-324-1234567",15],
      ["00923241234567","0092-324-1234567",16],
      ["923241234567","92-324-1234567",14],
    ]) {
      await phone.fill("");await phone.pressSequentially(raw+"98765");
      assert.equal(await phone.inputValue(),expected);
      assert.equal(await phone.getAttribute("maxlength"),String(max));
      await phone.pressSequentially("abc");assert.equal(await phone.inputValue(),expected);
    }
    await phone.fill("");await phone.pressSequentially("03241234567");
    await phone.evaluate(el=>el.setSelectionRange(6,6));await phone.pressSequentially("9");
    assert.equal(await phone.inputValue(),"0324-1234567");
    await phone.evaluate(el=>el.setSelectionRange(6,7));await phone.pressSequentially("9");
    assert.equal(await phone.inputValue(),"0324-1934567");
    await pasteReplacement(phone,"  +92 324 12345679876  ");assert.equal(await phone.inputValue(),"+92-324-1234567");
    await pasteReplacement(phone,"0092 324 12345679876");assert.equal(await phone.inputValue(),"0092-324-1234567");
    await pasteReplacement(phone,"032412345679876");assert.equal(await phone.inputValue(),"0324-1234567");
    await phone.press("End");await phone.press("Backspace");await phone.pressSequentially("98");
    assert.equal(await phone.inputValue(),"0324-1234569");
    await phone.press("Control+A");await phone.press("Backspace");assert.equal(await phone.inputValue(),"");
    await page.setViewportSize({width:390,height:844});await phone.pressSequentially("0324123456789");
    assert.equal(await phone.inputValue(),"0324-1234567");
    assert.deepEqual(errors,[]);
    console.log("PASS mobile: local/international digit caps, full-number paste across formats, selection editing and mobile typing");
  } finally {await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
