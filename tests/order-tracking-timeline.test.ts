import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderTrackingTimeline, resolveTrackingNumber } from "../lib/order-tracking-timeline";

const at = (h: number) => new Date(Date.UTC(2026, 9, 20, h));
const iso = (h: number) => at(h).toISOString();

test("parent order events become a chronological timeline with only real stages", () => {
  const timeline = buildOrderTrackingTimeline({
    createdAt: at(4),
    orderStatus: "packed",
    events: [
      { eventType: "order_created", toStatus: "confirmed", createdAt: at(4) },
      { eventType: "payment_status_changed", toStatus: "received", createdAt: at(5) },
      { eventType: "fulfilment_status_changed", toStatus: "packed", createdAt: at(7) },
    ],
    shops: [],
  });
  assert.deepEqual(timeline, [
    { status: "placed", at: iso(4) },
    { status: "confirmed", at: iso(4) },
    { status: "packed", at: iso(7) },
  ]);
});

test("multi-seller stages appear only once the slowest active seller reaches them", () => {
  const timeline = buildOrderTrackingTimeline({
    createdAt: at(1),
    orderStatus: "confirmed",
    events: [],
    shops: [
      { status: "shipped", statusHistory: [{ status: "pending", updatedAt: iso(1) }, { status: "confirmed", updatedAt: iso(2) }, { status: "packed", updatedAt: iso(3) }, { status: "shipped", updatedAt: iso(5) }] },
      { status: "confirmed", statusHistory: [{ status: "pending", updatedAt: iso(1) }, { status: "confirmed", updatedAt: iso(6) }] },
      { status: "cancelled", statusHistory: [{ status: "cancelled", updatedAt: iso(2) }] },
    ],
  });
  assert.deepEqual(timeline, [
    { status: "placed", at: iso(1) },
    { status: "confirmed", at: iso(6) },
  ]);
});

test("a seller that skips a milestone still completes it; malformed history is ignored", () => {
  const timeline = buildOrderTrackingTimeline({
    createdAt: at(1),
    orderStatus: "shipped",
    events: [],
    shops: [{ status: "shipped", statusHistory: [{ status: "shipped", updatedAt: iso(3) }, { status: "bogus", updatedAt: iso(2) }, { status: "packed", updatedAt: "not a date" }, null] }],
  });
  assert.deepEqual(timeline.map((e) => e.status), ["placed", "confirmed", "packed", "shipped"]);
  assert.ok(timeline.slice(1).every((e) => e.at === iso(3)));
});

test("cancellation is shown only for cancelled orders", () => {
  const cancelled = buildOrderTrackingTimeline({
    createdAt: at(1), cancelledAt: at(2), orderStatus: "cancelled", events: [], shops: [],
  });
  assert.deepEqual(cancelled.at(-1), { status: "cancelled", at: iso(2) });
  const active = buildOrderTrackingTimeline({
    createdAt: at(1), orderStatus: "confirmed",
    events: [{ eventType: "order_cancelled", toStatus: "cancelled", createdAt: at(2) }], shops: [],
  });
  assert.equal(active.some((e) => e.status === "cancelled"), false);
});

test("tracking number prefers the order's, then a single unambiguous seller number", () => {
  assert.equal(resolveTrackingNumber(" TCS1 ", [{ status: "shipped", statusHistory: [], trackingNumber: "X" }]), "TCS1");
  assert.equal(resolveTrackingNumber(null, [{ status: "shipped", statusHistory: [], trackingNumber: "LEO9" }]), "LEO9");
  assert.equal(resolveTrackingNumber(null, [{ status: "shipped", statusHistory: [], trackingNumber: "A" }, { status: "shipped", statusHistory: [], trackingNumber: "B" }]), null);
  assert.equal(resolveTrackingNumber("", []), null);
});
