import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderTrackingTimeline, resolveTrackingNumber } from "../lib/order-tracking-timeline";
import { resolveCustomerOrderTrackStatus } from "../lib/order-track-status";

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

test("pickup milestones appear only after recorded events for every active seller", () => {
  const base = (hour: number) => [{ status: "pending", updatedAt: iso(1) }, { status: "confirmed", updatedAt: iso(2) }, { status: "packed", updatedAt: iso(hour) }];
  const first = { status: "packed", statusHistory: base(3), pickupRequest: { status: "collected", history: [{ status: "ready", at: iso(4) }, { status: "scheduled", at: iso(5) }, { status: "collected", at: iso(7) }] } };
  const second = { status: "packed", statusHistory: base(4), pickupRequest: { status: "scheduled", history: [{ status: "ready", at: iso(5) }, { status: "scheduled", at: iso(6) }] } };
  const input = { createdAt: at(1), orderStatus: "packed", events: [], shops: [first, second] };
  const scheduled = buildOrderTrackingTimeline(input);
  assert.deepEqual(scheduled.find(e => e.status === "pickup_scheduled"), { status: "pickup_scheduled", at: iso(6) });
  assert.equal(scheduled.some(e => e.status === "collected" || e.status === "shipped"), false);
  second.pickupRequest.history.push({ status: "collected", at: iso(8) });
  const collected = buildOrderTrackingTimeline(input);
  assert.deepEqual(collected.find(e => e.status === "collected"), { status: "collected", at: iso(8) });
});

test("a stale parent shipment or delivery cannot outrun seller fulfilment", () => {
  assert.equal(resolveCustomerOrderTrackStatus("delivered", [{ status: "packed" }]), "packing");
  assert.equal(resolveCustomerOrderTrackStatus("shipped", [{ status: "shipped" }, { status: "packed" }]), "packing");
  const timeline = buildOrderTrackingTimeline({ createdAt: at(1), orderStatus: "packed", events: [{ eventType: "fulfilment_status_changed", toStatus: "shipped", createdAt: at(5) }], shops: [{ status: "packed", statusHistory: [{ status: "packed", updatedAt: iso(3) }] }] });
  assert.equal(timeline.some(event => event.status === "shipped"), false);
});
