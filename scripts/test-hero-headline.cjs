const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("playwright-core");

const WORDS = ["Jo", "chahiye,", "JORO", "par", "dhoondo."];

async function main() {
  const bundle = await build({
    stdin: {
      contents: `import React, {StrictMode} from 'react';
        import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
        import {HeroHeadline} from './components/user/HeroHeadline';
        let root;
        window.mountHeadline = () => {root=createRoot(document.getElementById('root'));flushSync(()=>root.render(<StrictMode><HeroHeadline/><h2>Na mile? Want post karo.</h2></StrictMode>));};
        window.unmountHeadline = () => flushSync(()=>root.unmount());`,
      resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    outfile: "hero-test.js", define: { "process.env.NODE_ENV": '"development"' },
  });
  const script = bundle.outputFiles.find(file => file.path.endsWith(".js")).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith(".css")).text;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("http://hero-preview.test/**", route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/app.js") return route.fulfill({contentType:"text/javascript",body:script});
      return route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><style>
        :root {--brand-primary-rgb:183 227 58} body {margin:0;background:#063d29}
        h1 {max-width:620px;font:900 55px/.98 Arial;letter-spacing:-.055em;color:white}
        .text-brand-primary {color:rgb(var(--brand-primary-rgb))}
        .sr-only {position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        ${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`});
    });
    await page.goto("http://hero-preview.test/");
    await page.clock.install({time:new Date("2026-10-08T12:00:00Z")});
    await page.clock.pauseAt(new Date("2026-10-08T12:00:01Z"));
    await page.evaluate(() => window.mountHeadline());
    const heading = page.getByRole("heading",{level:1,name:WORDS.join(" "),exact:true});
    const read = () => heading.evaluate(h => {
      const words = [...h.querySelectorAll("[data-hero-word]")];
      const active = [...h.querySelectorAll('[data-active="true"]')];
      const box = h.getBoundingClientRect();
      return {
        visible:words.filter(word=>getComputedStyle(word).visibility==="visible").map(word=>word.dataset.heroWord),
        complete:words.map(word=>word.firstChild.textContent),
        active:active.length, cursorWord:active[0]?.parentElement.dataset.heroWord || null,
        height:box.height, nextTop:h.nextElementSibling.getBoundingClientRect().top,
      };
    });
    const start = await read();
    async function expectState(count) {
      const state = await read();
      assert.deepEqual(state.visible, WORDS.filter((_, index) => index < count));
      assert.deepEqual(state.complete, WORDS, "Every word stays whole and mounted");
      assert.equal(state.active, count === 5 ? 0 : 1);
      assert.equal(state.cursorWord, count > 0 && count < 5 ? WORDS[count-1] : null);
      assert.equal(state.height,start.height);assert.equal(state.nextTop,start.nextTop);
      assert.equal(await page.locator("h2").innerText(),"Na mile? Want post karo.");
    }
    await expectState(5);
    await page.clock.runFor(2499);await expectState(5);
    await page.clock.runFor(1);await expectState(1);
    for(let count=2;count<=5;count++) {
      await page.clock.runFor(249);await expectState(count-1);
      await page.clock.runFor(1);await expectState(count);
    }
    await page.clock.runFor(2500);await expectState(1);
    await page.evaluate(()=>window.unmountHeadline());
    await page.clock.runFor(5000);
    await page.evaluate(()=>window.mountHeadline());await expectState(5);
    await page.clock.runFor(2500);await expectState(1);
    const cursor = heading.locator('[data-active="true"]');
    const blink = await cursor.evaluate(element => {
      const animation=element.getAnimations()[0];
      animation.pause();animation.currentTime=0;
      const on=getComputedStyle(element).opacity;
      animation.currentTime=600;
      const off=getComputedStyle(element).opacity;
      const rect=element.getBoundingClientRect();
      return {on,off,color:getComputedStyle(element).backgroundColor,block:rect.width>0&&rect.height>rect.width};
    });
    assert.deepEqual(blink,{on:"1",off:"0",color:"rgb(183, 227, 58)",block:true});
    await page.emulateMedia({reducedMotion:"reduce"});
    assert.equal(await cursor.evaluate(element=>getComputedStyle(element).animationName),"none");
    assert.deepEqual(errors,[]);
    console.log("PASS complete first paint, word timing, stable layout, blinking lime cursor, reduced motion and StrictMode cleanup");

    const live = await browser.newPage({viewport:{width:1440,height:900}});
    live.on("pageerror",error=>errors.push(error.message));
    await live.goto(process.env.HERO_TEST_URL || "http://localhost:3000/",{waitUntil:"domcontentloaded",timeout:90000});
    await live.locator("[data-hero-word]").first().waitFor({state:"attached",timeout:60000});
    await live.evaluate(()=>document.fonts.ready);
    for(const width of [320,360,390,768,1024,1440,1920]) {
      await live.setViewportSize({width,height:900});
      const layout=await live.locator(".joro-v4-hero h1").evaluate(h=>{
        const words=[...h.querySelectorAll("[data-hero-word]")];
        const rect=h.getBoundingClientRect();
        return {lines:[...new Set(words.map(word=>word.getBoundingClientRect().top))],overflow:h.scrollWidth>h.clientWidth,
          bounds:words.every(word=>word.getBoundingClientRect().left>=rect.left&&word.getBoundingClientRect().right<=rect.right+1),
          colors:words.map(word=>getComputedStyle(word).color)};
      });
      assert.equal(layout.lines.length,2,`${width}px: exactly two lines`);
      assert.equal(layout.overflow,false);assert(layout.bounds);
      assert.deepEqual(layout.colors,["rgb(255, 255, 255)","rgb(255, 255, 255)","rgb(183, 227, 58)","rgb(255, 255, 255)","rgb(255, 255, 255)"]);
    }
    assert.deepEqual(errors,[]);
    await live.waitForFunction(()=>document.querySelectorAll('[data-hero-word][data-visible="true"]').length===5);
    await live.screenshot({path:".next/hero-whole-words.png"});
    console.log("PASS live homepage: two responsive lines at 320–1920px, original colors, no overflow or runtime errors");
  } finally {await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
