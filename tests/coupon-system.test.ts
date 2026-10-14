import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, type VendorCoupon } from "@prisma/client";
import { calculateCoupon } from "../lib/coupon-service";
import { calculateCouponFundingReversalCents, calculateVendorRefundDebitCents, grossUpPlatformRefundCents } from "../lib/refund-math";

const coupon = (overrides: Partial<VendorCoupon> = {}): VendorCoupon => ({
  id: "c1", vendorId: "v1", couponCode: "SAVE20", codeKey: "SAVE20", discountType: "percent", discountValue: new Prisma.Decimal(20), minOrderAmount: new Prisma.Decimal(0), maxDiscount: null, startDate: null, expiryDate: null, productIds: [], categories: [], collectionIds: [], selectedVendorIds: [], customerIds: [], perCustomerLimit: null, ownerType: "VENDOR", fundingType: "VENDOR_FUNDED", budget: null, spent: new Prisma.Decimal(0), approvals: [], approvedBy: null, approvedAt: null, updatedAt: new Date(), maxUses: null, usedCount: 0, status: "active", createdAt: new Date(), ...overrides,
});
const lines = [
  { productId: "p1", vendorId: "v1", category: "Home", price: 100, quantity: 1 },
  { productId: "p2", vendorId: "v2", category: "Home", price: 200, quantity: 1 },
];

test("vendor coupon discounts only its vendor in a multi-vendor cart", () => {
  const result = calculateCoupon(coupon(), lines, "customer");
  assert.equal(result.discount, 2000);
  assert.deepEqual(result.allocations.map(a => a.productId), ["p1"]);
});
test("platform funding leaves a separate funding amount", () => {
  const result = calculateCoupon(coupon({ ownerType: "ADMIN", fundingType: "PLATFORM_FUNDED", selectedVendorIds: ["v1"], productIds: ["p1"], approvals: ["v1"], approvedAt: new Date() }), lines, "customer");
  assert.equal(result.discount, 2000);
  assert.equal(result.platformFunded, 2000);
});
test("vendor-funded admin campaign requires recorded approvals", () => {
  const campaign = coupon({ ownerType: "ADMIN", vendorId: null, selectedVendorIds: ["v1"], productIds: ["p1"], approvedAt: new Date() });
  assert.throws(() => calculateCoupon(campaign, lines, "customer"), /approval/);
  assert.equal(calculateCoupon({ ...campaign, approvals: ["v1"] }, lines, "customer").discount, 2000);
});
test("inactive, future and expired coupons fail", () => {
  assert.throws(() => calculateCoupon(coupon({ status: "paused" }), lines, "customer"), /inactive/);
  assert.throws(() => calculateCoupon(coupon({ startDate: new Date("2030-01-01") }), lines, "customer"), /not yet/);
  assert.throws(() => calculateCoupon(coupon({ expiryDate: new Date("2020-01-01") }), lines, "customer"), /expired/);
});
test("minimum purchase uses only eligible products", () => {
  assert.throws(() => calculateCoupon(coupon({ minOrderAmount: new Prisma.Decimal(150) }), lines, "customer"), /Minimum/);
});
test("existing product deals do not stack", () => {
  assert.throws(() => calculateCoupon(coupon(), [{ ...lines[0], originalPrice: 150 }], "customer"), /eligible/);
});
test("fixed discount caps at eligible subtotal", () => {
  const result = calculateCoupon(coupon({ discountType: "fixed", discountValue: new Prisma.Decimal(999) }), lines, "customer");
  assert.equal(result.discount, 10000);
});
test("fixed allocation rounds to the exact cent", () => {
  const result = calculateCoupon(coupon({ discountType: "fixed", discountValue: new Prisma.Decimal("0.01") }), [
    { ...lines[0], price: 0.01 }, { ...lines[0], productId: "p3", price: 0.01 },
  ], "customer");
  assert.equal(result.allocations.reduce((sum, a) => sum + a.discount, 0), 1);
});
test("removed product and wrong vendor do not qualify", () => {
  assert.throws(() => calculateCoupon(coupon({ productIds: ["deleted"] }), lines, "customer"), /eligible/);
  assert.throws(() => calculateCoupon(coupon(), [lines[1]], "customer"), /eligible/);
});
test("maximum discount caps a percentage promotion", () => {
  const result = calculateCoupon(coupon({ maxDiscount: new Prisma.Decimal(5) }), lines, "customer");
  assert.equal(result.discount, 500);
});
test("customer targeting excludes other accounts", () => {
  assert.throws(() => calculateCoupon(coupon({ customerIds: ["selected"] }), lines, "customer"), /account/);
  assert.equal(calculateCoupon(coupon({ customerIds: ["selected"] }), lines, "selected").discount, 2000);
});
test("admin product and vendor targeting intersect", () => {
  const campaign = coupon({ ownerType: "ADMIN", fundingType: "PLATFORM_FUNDED", vendorId: null, selectedVendorIds: ["v1"], productIds: ["p2"], approvals: ["v1"], approvedAt: new Date() });
  assert.throws(() => calculateCoupon(campaign, lines, "customer"), /eligible/);
});
test("mixed deal and full-price lines discount only full-price items", () => {
  const result = calculateCoupon(coupon(), [{ ...lines[0], originalPrice: 150 }, { ...lines[0], productId: "full-price", price: 40 }], "customer");
  assert.equal(result.discount, 800);
  assert.deepEqual(result.allocations.map(a => a.productId), ["full-price"]);
});
test("full platform-funded refund reverses the promotion and protected vendor sale", () => {
  const reversal = calculateCouponFundingReversalCents({ discountCents: 2000, customerPaidCents: 8000, customerRefundCents: 8000, alreadyReversedCents: 0 });
  const grossRefund = grossUpPlatformRefundCents(8000, 10000, 8000);
  assert.equal(reversal, 2000);
  assert.equal(calculateVendorRefundDebitCents({ customerRefundCents: grossRefund, lineSaleCents: 10000, lineVendorCents: 9000 }), 9000);
});
test("partial platform-funded refunds cannot reverse more than the funded discount", () => {
  assert.equal(calculateCouponFundingReversalCents({ discountCents: 2000, customerPaidCents: 8000, customerRefundCents: 4000, alreadyReversedCents: 0 }), 1000);
  assert.equal(calculateCouponFundingReversalCents({ discountCents: 2000, customerPaidCents: 8000, customerRefundCents: 4000, alreadyReversedCents: 1500 }), 500);
  assert.equal(grossUpPlatformRefundCents(4000, 10000, 8000), 5000);
});
