import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  customerOwnsReviewOrder,
  isOrderProductDeliveredForReview,
  isReviewOrderEligible,
} from "../lib/order-review-eligibility";
import { isPurchaseBackedReview } from "../lib/product-review-stats-service";
import {
  detectReviewPhotoExtension,
  hasDangerousReviewContent,
  isPublicReviewPhotoUrl,
  reviewPhotoUrlForCustomer,
  reviewSubmissionSchema,
} from "../lib/review-policy";

function orderFixture(input?: {
  customerId?: string | null;
  orderStatus?: string;
  productId?: string;
  shopStatus?: string | null;
}) {
  const productId = input?.productId ?? "product-a";
  return {
    id: "order-a",
    customerId: input?.customerId === undefined ? "customer-a" : input.customerId,
    orderStatus: input?.orderStatus ?? "delivered",
    vendorShopOrders: [],
    orderItems: [
      {
        productId,
        inventoryLine:
          input?.shopStatus === undefined
            ? null
            : {
                vendorShopOrder:
                  input.shopStatus === null
                    ? null
                    : { status: input.shopStatus },
              },
      },
    ],
  } as never;
}

test("review ownership requires the immutable customer relation", () => {
  assert.equal(customerOwnsReviewOrder("customer-a", "customer-a"), true);
  assert.equal(customerOwnsReviewOrder("customer-a", "customer-b"), false);
  assert.equal(customerOwnsReviewOrder(null, "customer-a"), false);
});

test("review eligibility is product-line delivery aware", () => {
  assert.equal(
    isReviewOrderEligible(orderFixture(), "customer-a", "product-a"),
    true
  );
  assert.equal(
    isReviewOrderEligible(
      orderFixture({ orderStatus: "pending" }),
      "customer-a",
      "product-a"
    ),
    false
  );
  assert.equal(
    isOrderProductDeliveredForReview(
      orderFixture({ orderStatus: "pending", shopStatus: "delivered" }),
      "product-a"
    ),
    true
  );
  assert.equal(
    isOrderProductDeliveredForReview(
      orderFixture({ orderStatus: "delivered", shopStatus: "shipped" }),
      "product-a"
    ),
    false,
    "a vendor line cannot inherit a delivered parent status"
  );
  assert.equal(
    isReviewOrderEligible(orderFixture(), "customer-b", "product-a"),
    false
  );
  assert.equal(
    isReviewOrderEligible(orderFixture(), "customer-a", "product-b"),
    false
  );
});

test("review payload rejects client verification, identity, unsafe content and bad ratings", () => {
  const valid = {
    orderId: "order-a",
    productId: "product-a",
    rating: 5,
    comment: "Excellent quality & fast delivery",
  };
  assert.equal(reviewSubmissionSchema.safeParse(valid).success, true);
  assert.equal(
    reviewSubmissionSchema.parse(valid).comment,
    "Excellent quality & fast delivery"
  );
  for (const rating of [0, 6, 2.5]) {
    assert.equal(
      reviewSubmissionSchema.safeParse({ ...valid, rating }).success,
      false
    );
  }
  for (const extra of [
    { customerId: "customer-b" },
    { verifiedPurchase: true },
    { reviewId: 123 },
  ]) {
    assert.equal(
      reviewSubmissionSchema.safeParse({ ...valid, ...extra }).success,
      false
    );
  }
  for (const comment of [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    "javascript:alert(1)",
    "safe\0unsafe",
  ]) {
    assert.equal(hasDangerousReviewContent(comment), true);
    assert.equal(
      reviewSubmissionSchema.safeParse({ ...valid, comment }).success,
      false
    );
  }
});

test("review photo paths and file signatures are customer scoped", () => {
  const own = "/uploads/reviews/customer-a/rev-123-abcdef12.jpg";
  assert.equal(reviewPhotoUrlForCustomer(own, "customer-a"), true);
  assert.equal(reviewPhotoUrlForCustomer(own, "customer-b"), false);
  assert.equal(
    reviewPhotoUrlForCustomer(
      "/uploads/reviews/customer-a/../customer-b/rev-123-abcdef12.jpg",
      "customer-a"
    ),
    false
  );
  assert.equal(isPublicReviewPhotoUrl(own), true);
  assert.equal(isPublicReviewPhotoUrl("https://evil.invalid/review.jpg"), false);
  assert.equal(
    detectReviewPhotoExtension(
      new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
      "image/jpeg"
    ),
    "jpg"
  );
  assert.equal(
    detectReviewPhotoExtension(
      new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e]),
      "image/png"
    ),
    null
  );
});

test("only active purchase-backed rows qualify for a Verified Purchase badge", () => {
  const validReview = {
    customerId: "customer-a",
    orderId: "order-a",
    productId: "product-a",
    order: orderFixture(),
  };
  assert.equal(isPurchaseBackedReview(validReview as never), true);
  assert.equal(
    isPurchaseBackedReview({ ...validReview, customerId: "customer-b" } as never),
    false
  );
  assert.equal(
    isPurchaseBackedReview({
      ...validReview,
      order: orderFixture({ orderStatus: "pending" }),
    } as never),
    false
  );
});

test("review write path reuses a canonical row and public stores use verified product reviews", () => {
  const route = readFileSync(resolve("app/api/reviews/route.ts"), "utf8");
  const storeStats = readFileSync(
    resolve("lib/vendor-review-stats-service.ts"),
    "utf8"
  );
  const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
  assert.match(route, /customerId_productId/);
  assert.match(route, /review\.upsert/);
  assert.match(route, /withdrawn: true/);
  assert.doesNotMatch(route, /orderEmailsMatch/);
  assert.match(storeStats, /productReviewStatsService/);
  assert.doesNotMatch(storeStats, /vendorReview\.aggregate/);
  assert.match(schema, /@@unique\(\[customerId, productId\]\)/);
});
