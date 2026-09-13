import test from "node:test";
import assert from "node:assert/strict";
import { allocateExactCents, toCents } from "../lib/payout-allocation";
import { customerOwnsRecord } from "../lib/order-ownership";
import {
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
} from "../lib/order-state";
import { hasAdminPermission, permissionsForRole } from "../lib/admin-permissions";
import {
  calculateRefundPaymentStatus,
  calculateVendorRefundDebitCents,
} from "../lib/refund-math";
import { slugifyStoreName, isReservedOrInvalidSlug } from "../lib/store-slug";

test("payout allocator splits the final earning without overpaying", () => {
  const allocations = allocateExactCents(
    [
      { id: "earning-1", availableCents: 5_400_00 },
      { id: "earning-2", availableCents: 2_000_00 },
    ],
    6_000_00
  );
  assert.deepEqual(allocations, [
    { earningId: "earning-1", amountCents: 5_400_00 },
    { earningId: "earning-2", amountCents: 600_00 },
  ]);
  assert.equal(
    allocations.reduce((sum, row) => sum + row.amountCents, 0),
    6_000_00
  );
});

test("payout allocator fails closed on insufficient balance", () => {
  assert.throws(
    () => allocateExactCents([{ id: "earning-1", availableCents: 100_00 }], 100_01),
    /Insufficient/
  );
});

test("money conversion is integer-cent based", () => {
  assert.equal(toCents("10.235"), 1024);
  assert.equal(toCents(5400), 540000);
});

test("order ownership requires the immutable customer id", () => {
  assert.equal(customerOwnsRecord("customer-a", "customer-a"), true);
  assert.equal(customerOwnsRecord("customer-a", "customer-b"), false);
  assert.equal(customerOwnsRecord(null, "customer-a"), false);
  assert.equal(customerOwnsRecord("customer-a", undefined), false);
});

test("fulfilment transitions are forward-only and cancellation stops at shipping", () => {
  assert.equal(canTransitionOrderStatus("confirmed", "packed"), true);
  assert.equal(canTransitionOrderStatus("packed", "confirmed"), false);
  assert.equal(canTransitionOrderStatus("packed", "cancelled"), true);
  assert.equal(canTransitionOrderStatus("shipped", "cancelled"), false);
  assert.equal(canTransitionOrderStatus("delivered", "shipped"), false);
});

test("payment transitions preserve refund finality", () => {
  assert.equal(canTransitionPaymentStatus("pending", "received"), true);
  assert.equal(canTransitionPaymentStatus("received", "refunded"), true);
  assert.equal(canTransitionPaymentStatus("refunded", "received"), false);
});

test("admin roles enforce least-privilege permissions", () => {
  assert.equal(hasAdminPermission(permissionsForRole("finance"), "payouts.manage"), true);
  assert.equal(hasAdminPermission(permissionsForRole("finance"), "vendors.manage"), false);
  assert.equal(hasAdminPermission(permissionsForRole("super_admin"), "anything"), true);
});

test("refund accounting stays in integer cents", () => {
  assert.equal(calculateRefundPaymentStatus(9_999, 10_000), "partially_refunded");
  assert.equal(calculateRefundPaymentStatus(10_000, 10_000), "refunded");
  assert.equal(
    calculateVendorRefundDebitCents({
      customerRefundCents: 5_000,
      lineSaleCents: 10_000,
      lineVendorCents: 8_500,
    }),
    4_250
  );
  assert.equal(
    calculateVendorRefundDebitCents({
      customerRefundCents: 20_000,
      lineSaleCents: 10_000,
      lineVendorCents: 8_500,
    }),
    8_500
  );
});

test("store slugs are URL-safe and derived deterministically from the shop name", () => {
  assert.equal(slugifyStoreName("Abc Electronics"), "abc-electronics");
  assert.equal(slugifyStoreName("Hamza's Mobile & Accessories!!"), "hamza-s-mobile-accessories");
  assert.equal(slugifyStoreName("   leading/trailing   "), "leading-trailing");
  assert.equal(slugifyStoreName(""), "store");
  assert.equal(slugifyStoreName("!!!"), "store");
});

test("reserved and malformed slugs are rejected", () => {
  assert.equal(isReservedOrInvalidSlug("admin"), true);
  assert.equal(isReservedOrInvalidSlug("api"), true);
  assert.equal(isReservedOrInvalidSlug("new"), true);
  assert.equal(isReservedOrInvalidSlug("checkout"), true);
  assert.equal(isReservedOrInvalidSlug("ab"), true, "too short");
  assert.equal(isReservedOrInvalidSlug("a".repeat(81)), true, "too long");
  assert.equal(isReservedOrInvalidSlug("Has-Capitals"), true, "must be lowercase");
  assert.equal(isReservedOrInvalidSlug("double--hyphen"), true, "no double hyphens");
  assert.equal(isReservedOrInvalidSlug("-leading-hyphen"), true);
  assert.equal(isReservedOrInvalidSlug("trailing-hyphen-"), true);
  assert.equal(isReservedOrInvalidSlug("abc-electronics"), false);
  assert.equal(isReservedOrInvalidSlug("hamza-mobile"), false);
});
