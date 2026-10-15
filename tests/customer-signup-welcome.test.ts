import test from "node:test";
import assert from "node:assert/strict";
import { customerRegistrationInput } from "../lib/customer-registration-input";
import { shouldShowCustomerWelcome } from "../lib/customer-welcome-policy";

const base = { name: "Customer", email: "Person@Example.com", password: "SecurePass123!" };

test("customer signup accepts an omitted or blank phone and keeps email required", () => {
  assert.equal(customerRegistrationInput.parse(base).phone, "");
  assert.equal(customerRegistrationInput.parse({ ...base, phone: "  " }).phone, "");
  assert.equal(customerRegistrationInput.safeParse({ ...base, email: "" }).success, false);
});

test("customer signup normalizes Pakistani phones and rejects invalid values", () => {
  assert.equal(customerRegistrationInput.parse({ ...base, phone: "+92 300 1234567" }).phone, "0300-1234567");
  assert.equal(customerRegistrationInput.parse({ ...base, phone: "03001234567" }).phone, "0300-1234567");
  assert.equal(customerRegistrationInput.safeParse({ ...base, phone: "12345" }).success, false);
});

test("existing customers never get the welcome, new customers get it only until seen", () => {
  const now = new Date();
  assert.equal(shouldShowCustomerWelcome(null, null), false);
  assert.equal(shouldShowCustomerWelcome(now, null), true);
  assert.equal(shouldShowCustomerWelcome(now, now), false);
});
