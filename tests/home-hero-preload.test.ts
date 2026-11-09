import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("next/dist/compiled/react");
const ReactDOM = require("next/dist/compiled/react-dom");
// Match Next's bundled React/ReactDOM aliases rather than mixing React 18 stable
// with the bundled streaming renderer used by the App Router.
const serverExports: Record<string, typeof require> = {};
runInNewContext(fs.readFileSync(require.resolve("next/dist/compiled/react-dom/cjs/react-dom-server.edge.development.js"), "utf8"), {
  exports: serverExports, process: { env: { NODE_ENV: "development" } },
  require: (name: string) => name === "react-dom" ? ReactDOM : require(name),
  console, TextEncoder, ReadableStream, setTimeout, clearTimeout, queueMicrotask,
});
const { renderToReadableStream } = serverExports;
const url = "/branding/hero/joro-premium-hero-bg.png";
const image = require("next/image");
const sizes = "(max-width: 639px) calc(100vw - 24px), (max-width: 1328px) calc(100vw - 48px), 1280px";
const expected = image.getImageProps({ src: url, alt: "", fill: true, sizes, priority: true }).props;

function component() {
  const exports: Record<string, () => null> = {};
  const code = ts.transpileModule(fs.readFileSync("components/user/HomeHeroPreload.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => {
    if (name === "react-dom") return ReactDOM;
    if (name === "next/image") return image;
    if (name === "@/lib/hero-image") return { heroBackground: url, heroBackgroundSizes: sizes };
    throw new Error("Unexpected import");
  } });
  return exports.HomeHeroPreload;
}

test("hero preload reaches the early shell before suspended content; repeated renders deduplicate", async () => {
  const Preload = component();
  let release!: () => void;
  let ready = false;
  const wait = new Promise<void>((resolve) => { release = () => { ready = true; resolve(); }; });
  function Content() { if (!ready) throw wait; return React.createElement("main", null, "Hero content"); }
  const stream = await renderToReadableStream(React.createElement("html", null,
    React.createElement("head"), React.createElement("body", null,
      React.createElement(Preload), React.createElement(Preload),
      React.createElement(React.Suspense, { fallback: "Loading" }, React.createElement(Content)))));
  const reader = stream.getReader();
  let html = new TextDecoder().decode((await reader.read()).value);
  try {
    assert.match(html, /<link rel="preload"[^>]*as="image"[^>]*fetchPriority="high"/i);
    assert.ok(html.includes("/_next/image?"));
    assert.ok(html.includes('imageSrcSet=') || html.includes('imagesrcset='));
    assert.ok(!html.includes("Hero content"), "preload must not wait for homepage data");
  } finally { release(); }
  for (;;) { const part = await reader.read(); if (part.done) break; html += new TextDecoder().decode(part.value); }
  assert.equal((html.match(/rel="preload"/g) || []).length, 1);
  assert.ok(html.includes(expected.srcSet.replace(/&/g, "&amp;")));
  assert.ok(html.includes("Hero content"));
});

test("unrelated render has no hero hint; displayed image shares the responsive preload source", async () => {
  const stream = await renderToReadableStream(React.createElement("html", null,
    React.createElement("head"), React.createElement("body", null, "Other route")));
  assert.ok(!(await new Response(stream).text()).includes(url));
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.equal(css.includes(`url("${url}")`), false, "Do not download the original PNG alongside optimized variants");
  const hero = fs.readFileSync("components/user/HeroSection.tsx", "utf8");
  assert.match(hero, /src=\{heroBackground\} alt="" fill priority sizes=\{heroBackgroundSizes\}/);
  const page = fs.readFileSync("app/(user)/page.tsx", "utf8");
  assert.match(page, /<HomeHeroPreload\s*\/>/);
  assert.ok(!fs.readFileSync("app/layout.tsx", "utf8").includes("HomeHeroPreload"));
  assert.ok(!fs.readFileSync("app/(user)/layout.tsx", "utf8").includes("HomeHeroPreload"));
});
