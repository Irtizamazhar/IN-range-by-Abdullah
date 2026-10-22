import test from "node:test";
import assert from "node:assert/strict";
import { calculateHandlingFee } from "../lib/handling-fee";

test("delivery settings include handling and no separate customer fee is charged", () => {
  for (const delivery of [0, 25, 50, 200]) {
    assert.equal(2000 + delivery + calculateHandlingFee(), 2000 + delivery);
  }
});
