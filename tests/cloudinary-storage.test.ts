import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { Writable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { uploadBufferToCloudinary, assertCloudinaryImageStored } from "../lib/cloudinary";
import { cloudinaryImageReference, isCloudinaryPhoto, isWantPhotoUrl } from "../lib/cloudinary-policy";
import { reviewPhotoUrlForCustomer, isPublicReviewPhotoUrl } from "../lib/review-policy";
import { assertWantPhotoStored, removeWantPhotoFile } from "../lib/want-photo-file";
import { wantInput } from "../lib/want-schema";
import { prisma } from "../lib/prisma";
import { GET as imageGET } from "../app/api/image/[id]/route";

const url = (id: string) => `https://res.cloudinary.com/test-cloud/image/upload/v123/${id}.png`;

test("public URL validation rejects traversal, raw files, transformations, hosts and URL suffixes", () => {
  const good = url("joro/wants/customer-a/abc");
  assert.ok(cloudinaryImageReference(good));
  for (const bad of [good + "?x=1", good + "#x", good.replace("https:", "http:"), good.replace("res.cloudinary.com", "evil.test"), good.replace("/image/", "/raw/"), good.replace("/v123/", "/w_20/v123/"), good.replace("/abc", "/../abc"), good.replace("/abc", "/%2e%2e/abc")]) {
    assert.equal(cloudinaryImageReference(bad), null, bad);
  }
});

test("Wants and review validation preserves legacy references and checks customer namespaces", () => {
  assert.ok(isWantPhotoUrl("/uploads/wants/want-123-abc.png"));
  assert.ok(isWantPhotoUrl(url("joro/wants/customer-a/abc")));
  assert.equal(isCloudinaryPhoto(url("joro/wants/customer-b/abc"), "wants", "customer-a"), false);
  const review = url("joro/reviews/customer-a/abc");
  assert.ok(reviewPhotoUrlForCustomer(review, "customer-a"));
  assert.equal(reviewPhotoUrlForCustomer(review, "customer-b"), false);
  assert.ok(isPublicReviewPhotoUrl(review));
  assert.ok(reviewPhotoUrlForCustomer("/uploads/reviews/customer-a/rev-123-abcdef12.jpg", "customer-a"));
  const input = { title: "Test Want", category: "Electronics", city: "Lahore", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null, photos: [url("joro/wants/customer-a/abc")] };
  assert.equal(wantInput.safeParse(input).success, true);
  assert.equal(wantInput.safeParse({ ...input, photos: ["https://evil.test/photo.png"] }).success, false);
});

test("signed storage upload, replacement and verification use immutable owner-scoped assets", async () => {
  const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  const previous = keys.map(key => process.env[key]);
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-only";
  process.env.CLOUDINARY_API_SECRET = "test-only";
  const assets = new Map<string, string>();
  const upload = mock.method(cloudinary.uploader, "upload_stream", (options: Record<string, unknown>, callback: (error: unknown, result: unknown) => void) => {
    assert.equal(options.resource_type, "image");
    assert.equal(options.overwrite, false);
    assert.deepEqual(options.allowed_formats, ["jpg", "jpeg", "png", "webp"]);
    const publicId = String(options.public_id);
    return new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) {
      assets.set(publicId, url(publicId));
      callback(null, { public_id: publicId, secure_url: url(publicId) }); done();
    } });
  });
  const resource = mock.method(cloudinary.api, "resource", async (id: string) => {
    if (!assets.has(id)) throw new Error("missing");
    return { secure_url: assets.get(id), resource_type: "image", type: "upload" };
  });
  try {
    const first = await uploadBufferToCloudinary(Buffer.from("fixture"), "joro/wants/customer-a");
    const replacement = await uploadBufferToCloudinary(Buffer.from("replacement"), "joro/wants/customer-a");
    assert.notEqual(first.secure_url, replacement.secure_url);
    await assertWantPhotoStored(first.secure_url, "customer-a");
    await assertCloudinaryImageStored(replacement.secure_url, "joro/wants/customer-a");
    await assert.rejects(assertWantPhotoStored(first.secure_url, "customer-b"));
    await assert.rejects(assertCloudinaryImageStored(first.secure_url.replace("test-cloud", "foreign-cloud"), "joro/wants/customer-a"));
    await assert.rejects(assertCloudinaryImageStored(url("joro/wants/customer-a/missing"), "joro/wants/customer-a"));
    await removeWantPhotoFile(first.secure_url);
    assert.ok(assets.has(first.public_id), "logical removal preserves physical asset");
    assert.equal(assets.size, 2);
    delete process.env.CLOUDINARY_API_SECRET;
    await assert.rejects(uploadBufferToCloudinary(Buffer.from("fixture"), "joro/products"), /not configured/);
    await assert.rejects(uploadBufferToCloudinary(Buffer.from("fixture"), "../private"), /Invalid image folder/);
    assert.equal(upload.mock.callCount(), 2, "no disk or SDK fallback without credentials");
  } finally {
    upload.mock.restore(); resource.mock.restore();
    keys.forEach((key, i) => previous[i] === undefined ? delete process.env[key] : process.env[key] = previous[i]);
  }
});

test("saved admin image IDs resolve after reload; existing database images remain byte-compatible", async () => {
  const reference = url("joro/products/abc");
  let kind: "cloudinary" | "filesystem" | "binary" = "cloudinary";
  const original = prisma.productImage.findUnique;
  prisma.productImage.findUnique = (async () => ({
    id: "image-a", productId: "product-a", product: { id: "product-a", isActive: true },
    mimeType: kind === "cloudinary" ? "application/x-joro-cloudinary-reference" : kind === "filesystem" ? "application/x-joro-public-upload-reference" : "image/png",
    data: Buffer.from(kind === "cloudinary" ? reference : kind === "filesystem" ? "/uploads/products/saved.png" : "legacy-image-bytes"), sortOrder: 0,
  })) as unknown as typeof prisma.productImage.findUnique;
  try {
    for (let reload = 0; reload < 2; reload++) {
      const response = await imageGET(new Request("https://joro.pk/api/image/image-a") as never, { params: { id: "image-a" } });
      assert.ok(response);
      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), reference);
    }
    kind = "filesystem";
    const persistent = await imageGET(new Request("https://joro.pk/api/image/image-a") as never, { params: { id: "image-a" } });
    assert.ok(persistent);
    assert.equal(persistent.status, 307);
    assert.equal(persistent.headers.get("location"), "/uploads/products/saved.png");
    kind = "binary";
    const legacy = await imageGET(new Request("https://joro.pk/api/image/image-a") as never, { params: { id: "image-a" } });
    assert.ok(legacy);
    assert.equal(legacy.status, 200);
    assert.equal(legacy.headers.get("content-type"), "image/png");
    assert.equal(await legacy.text(), "legacy-image-bytes");
  } finally { prisma.productImage.findUnique = original; }
});
