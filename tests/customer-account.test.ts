import test from "node:test";
import assert from "node:assert/strict";
import { safeAccountLink, canCustomerCancelOrder } from "../lib/customer-account-policy";
import { addressSchema, profileSchema } from "../lib/customer-address-schema";
import { customerServiceSnapshot } from "../lib/customer-service-policy";

test("notification destinations reject external and encoded redirect tricks", () => {
  for (const value of [null, "", "https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/%2fevil.invalid", "/%5cevil.invalid", "/%0aevil", "/bad%", "javascript:alert(1)"]) assert.equal(safeAccountLink(value), null, String(value));
  assert.equal(safeAccountLink("/account/orders/own?from=notice#details"), "/account/orders/own?from=notice#details");
});
test("profile sanitization rejects blank markup and cannot accept auth fields", () => {
  assert.deepEqual(profileSchema.parse({ name: "<b>Customer</b>", phone: "+92 300 1234567", customerId: "other", passwordHash: "bad", isActive: false }), { name: "Customer", phone: "+92 300 1234567" });
  for (const name of ["", "<script>x</script>", "a".repeat(201)]) assert.equal(profileSchema.safeParse({ name, phone: "" }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Customer", phone: "letters" }).success, false);
});
test("partial address updates preserve an omitted default flag", () => {
  assert.deepEqual(addressSchema.partial().parse({ city: "Lahore", customerId: "other" }), { city: "Lahore" });
  assert.deepEqual(addressSchema.partial().parse({ isDefault: false }), { isDefault: false });
});
test("cancellation link excludes paid, closed and partly shipped orders", () => {
  const order = { orderStatus: "pending", paymentStatus: "pending", vendorShopOrders: [{ status: "packed" }] };
  assert.equal(canCustomerCancelOrder(order), true);
  for (const paymentStatus of ["received", "partially_refunded", "refunded"]) assert.equal(canCustomerCancelOrder({ ...order, paymentStatus }), false);
  for (const orderStatus of ["shipped", "delivered", "cancelled"]) assert.equal(canCustomerCancelOrder({ ...order, orderStatus }), false);
  assert.equal(canCustomerCancelOrder({ ...order, vendorShopOrders: [{ status: "shipped" }] }), false);
});
test("customer service terms exclude commissions and internal snapshot values", () => {
  const result = customerServiceSnapshot({ name: "Assembly", total: "500", commissionRate: "20", vendorPayable: "400", adminNote: "private", warranty: { secret: true } });
  assert.equal(result.name, "Assembly"); assert.equal(result.total, "500"); assert.equal(result.warranty, "");
  assert.equal("vendorPayable" in result, false); assert.equal("adminNote" in result, false);
});