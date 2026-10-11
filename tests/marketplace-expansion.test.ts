import test from "node:test";
import assert from "node:assert/strict";
import { wantInput } from "../lib/want-schema";

const base = { title: "Need an AC installation", category: "Home", city: "Lahore", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null };
test("request types default existing Wants to products and validate new types", () => {
  assert.equal(wantInput.parse(base).requestType, "PRODUCT");
  assert.equal(wantInput.parse({ ...base, requestType: "SERVICE", description: "Install split AC" }).requestType, "SERVICE");
  assert.equal(wantInput.parse({ ...base, requestType: "GIFT", occasion: "Birthday", description: "Personalized gift box" }).occasion, "Birthday");
  assert.equal(wantInput.safeParse({ ...base, requestType: "LISTING" }).success, false);
  assert.equal(wantInput.safeParse({ ...base, requestType: "GIFT", description: "Gift details" }).success, false);
});
test("gift requests retain existing budget, city and date validation", () => {
  const gift = { ...base, requestType: "GIFT", occasion: "Birthday", description: "Personalized gift box" };
  assert.equal(wantInput.safeParse({ ...gift, city: "" }).success, false);
  assert.equal(wantInput.safeParse({ ...gift, budgetFlexible: false, budgetMax: null }).success, false);
  assert.equal(wantInput.safeParse({ ...gift, needBy: "2020-01-01T00:00:00.000Z" }).success, false);
});
