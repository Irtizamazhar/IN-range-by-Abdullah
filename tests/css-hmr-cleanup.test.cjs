const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const cleanupLoader = require("../scripts/webpack/css-hmr-cleanup-loader.cjs");
const runtimePath = require.resolve(
  "next/dist/compiled/mini-css-extract-plugin/hmr/hotModuleReplacement.js",
);
const runtimeSource = fs.readFileSync(runtimePath, "utf8");

function createRuntime(source) {
  const timers = new Map();
  const removals = [];
  let nextTimer = 0;
  let replacement;

  const head = {
    children: [],
    appendChild(link) {
      this.children.push(link);
      link.parentNode = this;
    },
    insertBefore(link, sibling) {
      const index = this.children.indexOf(sibling);
      assert.notEqual(index, -1);
      this.children.splice(index, 0, link);
      link.parentNode = this;
    },
    removeChild(link) {
      const index = this.children.indexOf(link);
      assert.notEqual(index, -1, "A stylesheet must not be removed twice");
      this.children.splice(index, 1);
      link.parentNode = null;
      removals.push(link);
    },
  };

  function stylesheet(href) {
    const listeners = new Map();
    return {
      href,
      parentNode: null,
      get nextSibling() {
        if (!this.parentNode) return null;
        const siblings = this.parentNode.children;
        return siblings[siblings.indexOf(this) + 1] || null;
      },
      cloneNode() {
        replacement = stylesheet(this.href);
        return replacement;
      },
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) || [];
        callbacks.push(callback);
        listeners.set(type, callbacks);
      },
      dispatch(type) {
        for (const callback of listeners.get(type) || []) {
          callback.call(this, { type, target: this });
        }
      },
    };
  }

  const original = stylesheet("http://localhost:3000/_next/static/css/app/layout.css");
  head.appendChild(original);
  const module = { exports: {} };
  vm.runInNewContext(
    source,
    {
      module,
      __dirname: path.dirname(runtimePath),
      document: {
        currentScript: { src: "http://localhost:3000/_next/static/chunks/app/layout.js" },
        querySelectorAll(selector) {
          assert.equal(selector, "link");
          return [...head.children];
        },
      },
      console: { log() {} },
      setTimeout(callback) {
        const timer = ++nextTimer;
        timers.set(timer, callback);
        return timer;
      },
      clearTimeout(timer) {
        timers.delete(timer);
      },
    },
    { filename: runtimePath },
  );

  const update = module.exports("css-cleanup-regression", { locals: true });
  update();
  assert.equal(timers.size, 1, "CSS refresh remains debounced");
  for (const callback of timers.values()) callback();
  timers.clear();
  assert.ok(replacement, "The real HMR runtime must create a replacement stylesheet");
  assert.equal(replacement.parentNode, head);

  return { original, replacement, head, removals };
}

for (const event of ["load", "error"]) {
  test(`unpatched Next reproduces null removeChild after ${event}`, () => {
    const runtime = createRuntime(runtimeSource);
    runtime.head.removeChild(runtime.original);

    assert.throws(
      () => runtime.replacement.dispatch(event),
      { name: "TypeError", message: /Cannot read properties of null \(reading 'removeChild'\)/ },
    );
  });

  test(`patched Next tolerates an already detached stylesheet on ${event}`, () => {
    const runtime = createRuntime(cleanupLoader(runtimeSource));
    runtime.head.removeChild(runtime.original);

    assert.doesNotThrow(() => {
      runtime.replacement.dispatch(event);
      runtime.replacement.dispatch(event);
      runtime.replacement.dispatch(event === "load" ? "error" : "load");
    });
    assert.equal(runtime.replacement.isLoaded, true);
    assert.deepEqual(runtime.removals, [runtime.original]);
    assert.deepEqual(runtime.head.children, [runtime.replacement]);
  });

  test(`patched Next removes an attached stylesheet exactly once on ${event}`, () => {
    const runtime = createRuntime(cleanupLoader(runtimeSource));

    runtime.replacement.dispatch(event);
    runtime.replacement.dispatch(event);
    runtime.replacement.dispatch(event === "load" ? "error" : "load");

    assert.equal(runtime.original.parentNode, null);
    assert.equal(runtime.replacement.isLoaded, true);
    assert.deepEqual(runtime.removals, [runtime.original]);
    assert.deepEqual(runtime.head.children, [runtime.replacement]);
  });
}

test("cleanup transform only rewrites removal of the same node", () => {
  const source = "oldLink.parentNode.removeChild(oldLink); other.parentNode.removeChild(child);";
  const transformed = cleanupLoader(source);
  assert.notEqual(transformed, source);
  assert.ok(transformed.includes("other.parentNode.removeChild(child);"));

  const removed = [];
  const child = {};
  const other = { parentNode: { removeChild(node) { removed.push(node); } } };
  assert.doesNotThrow(() => vm.runInNewContext(transformed, {
    oldLink: { parentNode: null },
    other,
    child,
  }));
  assert.deepEqual(removed, [child]);
});

test("cleanup transform leaves unmatched and already guarded source unchanged", () => {
  for (const source of [
    "const ready = true;",
    "link.parentNode?.removeChild(link);",
    "parent.parentNode.removeChild(child);",
  ]) {
    assert.equal(cleanupLoader(source), source);
  }
});
