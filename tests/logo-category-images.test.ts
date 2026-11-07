import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { getImageProps } from "next/image";
import { isOptimizablePublicCategoryImage, shouldUnoptimizeCategoryImage } from "../lib/public-category-image-policy";
import { shouldUnoptimizeImageSrc } from "../lib/should-unoptimize-next-image";

const require = createRequire(import.meta.url);
test("only flat public category raster URLs receive an optimization exception", () => {
  for (const src of ["/uploads/categories/1774945844940-image.png", "/uploads/categories/image-123-abc.webp", "/uploads/categories/PHOTO.JPG"]) {
    assert.equal(isOptimizablePublicCategoryImage(src), true);
    assert.equal(shouldUnoptimizeCategoryImage(src), false);
    assert.equal(shouldUnoptimizeImageSrc(src), true, "global bypass stays intact");
  }
});

test("private, malformed, external and unrelated sources retain existing behavior", () => {
  for (const src of ["/api/image/private", "/uploads/vendor-docs/cnic.png", "/uploads/payment-proofs/proof.png", "/uploads/categories/../private.png", "/uploads/categories/%2e%2e.png", "/uploads/categories/a%2fb.png", "/uploads/categories/a\\b.png", "/uploads/categories//a.png", "/uploads/categories/owner/a.png", "/uploads/categories/.hidden.png", "/uploads/categories/a..png", "/uploads/categories/a.svg", "/uploads/categories/a.png?x=1", "/uploads/categories/a.png#x", "/uploads/Categories/a.png", "//evil.test/uploads/categories/a.png", "https://joro.pk/uploads/categories/a.png", "https://res.cloudinary.com/cloud/image/upload/a.png", "blob:preview", "data:image/png;base64,a", "/uploads/products/a.png"]) {
    assert.equal(isOptimizablePublicCategoryImage(src), false, src);
    assert.equal(shouldUnoptimizeCategoryImage(src), shouldUnoptimizeImageSrc(src), src);
  }
});

function load(file: string) {
  const exports: Record<string, (props: Record<string, unknown>) => unknown> = {};
  runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => {
    if (name === "next/image") return { __esModule: true, default: "test-image" };
    if (name.endsWith(".png")) return { src: "/logo.png", width: 1774, height: 887 };
    if (name.endsWith(".css")) return {};
    if (name.includes("LoadingLink")) return { __esModule: true, default: "test-link" };
    return require(name);
  } });
  return exports;
}
type Element = { type: unknown; props: Record<string, unknown> & { children?: Element | Element[] } };
function image(value: unknown): Element | undefined {
  if (!value || typeof value !== "object") return;
  const el = value as Element;
  if (el.type === "test-image") return el;
  for (const child of [el.props?.children].flat()) { const found = image(child); if (found) return found; }
}

test("logo sizes match normal, compact, inverse and loader CSS without changing priority defaults", () => {
  const { LogoMark } = load("components/user/LogoMark.tsx");
  for (const [props, sizes] of [
    [{}, "(max-width: 639px) 118px, 164px"],
    [{ compact: true }, "(max-width: 639px) 106px, 116px"],
    [{ inverse: true }, "(max-width: 639px) 150px, 176px"],
    [{ compact: true, inverse: true }, "(max-width: 639px) 150px, 176px"],
  ] as const) {
    assert.equal(image(LogoMark(props))?.props.sizes, sizes);
    assert.equal(image(LogoMark(props))?.props.priority, true);
  }
  assert.equal(image(LogoMark({ priority: false }))?.props.priority, false);
  const loader = image(load("components/ui/GlobalLoaderVisual.tsx").GlobalLoaderVisual({ message: "Loading" }));
  assert.equal(loader?.props.sizes, "(max-width: 639px) 122.4px, 172.8px");
  assert.equal(loader?.props.priority, true);
  assert.match(fs.readFileSync("components/user/Footer.tsx", "utf8"), /<LogoMark href="\/" priority=\{false\}/);
});

test("Next image props keep category URL and responsive widths; private uploads remain direct", () => {
  const src = "/uploads/categories/historical.png";
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: "(min-width: 640px) 76px, 80px", loading: "lazy", unoptimized: shouldUnoptimizeCategoryImage(src) });
  assert.ok(props.srcSet?.includes("96w"));
  assert.equal(new URL(props.src, "https://joro.pk").searchParams.get("url"), src);
  assert.equal(props.loading, "lazy");
  const privateSrc = "/api/image/private";
  assert.equal(getImageProps({ src: privateSrc, alt: "", width: 80, height: 80, unoptimized: shouldUnoptimizeCategoryImage(privateSrc) }).props.srcSet, undefined);
});
