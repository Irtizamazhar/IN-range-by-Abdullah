import test from "node:test";
import assert from "node:assert/strict";
import { isOptimizablePublicProductImage, shouldUnoptimizeProductImage } from "../lib/public-product-image-policy";
import { shouldUnoptimizeImageSrc } from "../lib/should-unoptimize-next-image";

test("only validated flat/owned public product raster paths override the existing bypass", () => {
  for (const src of ["/uploads/products/old.jpg", "/uploads/products/owner/image.jpeg", "/uploads/vendor-products/legacy.png", "/uploads/vendor-products/vendor-a/vp-123-abc.webp", "/uploads/products/PHOTO.PNG"]) {
    assert.equal(isOptimizablePublicProductImage(src), true, src);
    assert.equal(shouldUnoptimizeProductImage(src), false);
    assert.equal(shouldUnoptimizeImageSrc(src), true, "global protection must remain unchanged");
  }
});

test("private/API/previews and unrelated uploads retain the original security policy", () => {
  for (const src of ["/api/image/private", "/api/private/vendor-docs/cnic.png", "/uploads/vendor-docs/cnic.png", "/uploads/payment-proofs/proof.jpg", "/uploads/wants/want.jpg", "/uploads/reviews/review.jpg", "/uploads/categories/category.jpg", "blob:https://joro.pk/preview", "data:image/png;base64,preview"]) {
    assert.equal(isOptimizablePublicProductImage(src), false, src);
    assert.equal(shouldUnoptimizeProductImage(src), shouldUnoptimizeImageSrc(src));
    assert.equal(shouldUnoptimizeProductImage(src), true);
  }
});

test("traversal, encoding, suffixes, extra depth and active content cannot obtain an optimization exception", () => {
  for (const src of ["/uploads/products/../private.jpg", "/uploads/products/owner/../../cnic.png", "/uploads/products/%2e%2e/cnic.jpg", "/uploads/products/a%2fb.jpg", "/uploads/products/a\\b.jpg", "/uploads/products//x.jpg", "/uploads/products/a/b/x.jpg", "/uploads/products/a.jpg?next=/api/private", "/uploads/products/a.png#fragment", "/uploads/products/a.svg", "/uploads/products/a.php", "/uploads/products/.hidden.jpg"]) {
    assert.equal(isOptimizablePublicProductImage(src), false, src);
    assert.equal(shouldUnoptimizeProductImage(src), true);
  }
});

test("Cloudinary/static/external sources keep exactly their existing behavior", () => {
  for (const src of ["https://res.cloudinary.com/cloud/image/upload/v123/joro/product.jpg", "/icon.png", "https://example.invalid/image.jpg", "//example.invalid/uploads/products/a.jpg", "https://joro.pk/uploads/products/a.jpg"]) {
    assert.equal(isOptimizablePublicProductImage(src), false);
    assert.equal(shouldUnoptimizeProductImage(src), shouldUnoptimizeImageSrc(src));
  }
});
