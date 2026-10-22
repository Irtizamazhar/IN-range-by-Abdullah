import test from "node:test";
import assert from "node:assert/strict";
import { storedOrderBreakdown } from "../lib/stored-order-breakdown";

test("new invoice uses the stored Rs. 50 fee and shows discounts separately from delivery", () => {
  assert.deepEqual(storedOrderBreakdown({
    orderItems: [{ price: 2000, quantity: 1 }],
    services: [{ price: 200, quantity: 1 }],
    couponRedemption: { discount: 100 },
    handlingFee: 50,
    totalAmount: 2650,
  }), { productSubtotal: 2000, serviceSubtotal: 200, discount: 100, handlingFee: 50, delivery: 500, total: 2650 });
});

test("historical invoice keeps its recorded percentage-based fee and total", () => {
  const oldOrder = { orderItems: [{ price: 2000, quantity: 1 }], handlingFee: 200, totalAmount: 2300 };
  assert.deepEqual(storedOrderBreakdown(oldOrder), { productSubtotal: 2000, serviceSubtotal: 0, discount: 0, handlingFee: 200, delivery: 100, total: 2300 });
});

test("negotiated quote invoice has zero fee", () => {
  const quote = storedOrderBreakdown({ orderItems: [{ price: 1800, quantity: 1 }], handlingFee: 0, totalAmount: 1875 });
  assert.equal(quote.handlingFee, 0);
  assert.equal(quote.delivery, 75);
});
