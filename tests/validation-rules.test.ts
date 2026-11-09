import test from "node:test";
import assert from "node:assert/strict";
import { personNameError, accountTitleError } from "../lib/validation/person-name";
import { personNameSchema, accountTitleSchema, pakistanCnicSchema, accountNumberSchema, optionalIbanSchema } from "../lib/validation/schemas";
import { isValidPakistanIban, normalizeAccountNumber, maskAccount } from "../lib/validation/bank";
import { cnicPlausibilityError, normalizePakistanCnic } from "../lib/pakistan-cnic";
import { normalizePakistanMobile } from "../lib/pakistan-phone";
import { pakistanMobileSchema } from "../lib/pakistan-phone-schema";
import { productPricingError, ORIGINAL_BELOW_SALE_ERROR, PRICE_ERROR } from "../lib/product-pricing";
import { computeDiscountPercent, displayDiscount } from "../lib/product-discount";
import { vendorProductCreateSchema, vendorProductUpdateSchema, mergedPricingError } from "../lib/vendor-product-schemas";
import { adminProductCreateSchema, adminProductUpdateSchema } from "../lib/admin-product-schema";
import { addressSchema, profileSchema } from "../lib/customer-address-schema";
import { customerRegistrationInput } from "../lib/customer-registration-input";
import { checkoutAddresses } from "../lib/checkout-addresses";
import { vendorSetupFields, vendorSetupSchema } from "../lib/vendor-onboarding-schema";

test("valid Pakistani mobiles are accepted and normalised; letters, symbols and short numbers are rejected", () => {
  for (const value of ["03001234567", "0300-1234567", "+923001234567", "+92 300 1234567", "00923001234567", "923001234567"]) {
    assert.equal(normalizePakistanMobile(value), "0300-1234567", value);
    assert.equal(pakistanMobileSchema.parse(value), "0300-1234567");
  }
  for (const value of ["0300123456a", "abc", "0300-12345", "+1 202 555 0100", "04235761234", "0300*1234567", "", "03001234567890"]) {
    assert.equal(normalizePakistanMobile(value), null, value);
  }
});

test("person names accept Urdu and international names; reject numbers, symbols and placeholders", () => {
  for (const name of ["Ali Khan", "Muhammad Ahmed", "محمد علی", "Zia-ul-Haq", "D'Souza", "Ayesha O’Brien", "José Álvarez", "Ali", "M. Imran"]) {
    assert.equal(personNameError(name), null, name);
  }
  for (const name of ["", "   ", "12345", "Ali123", "John!!", "a", "@@@", "aaaa", "Ali -- Khan", "<b>x</b>", "x".repeat(101)]) {
    assert.ok(personNameError(name), name);
  }
  assert.equal(personNameSchema("Name").parse("  Ali   Khan "), "Ali Khan");
  assert.equal(personNameSchema("Name").safeParse("<script>alert(1)</script>").success, false);
});

test("bank account titles allow business names but never numeric-only or symbol-heavy values", () => {
  for (const title of ["Ali Khan", "Khan Traders (Pvt) Ltd", "A & B Co. 2"]) assert.equal(accountTitleError(title), null, title);
  for (const title of ["", "123456", "$$$$", "A!", "a-a-a-a-a-a"]) assert.ok(accountTitleError(title), title);
  assert.equal(accountTitleSchema.parse(" Ali  Khan "), "Ali Khan");
});

test("CNIC: 13 digits with or without dashes; all-zero, repeated, sequential and impossible province prefixes rejected", () => {
  assert.equal(normalizePakistanCnic("3520212345671"), "35202-1234567-1");
  assert.equal(normalizePakistanCnic("35202-1234567-1"), "35202-1234567-1");
  assert.equal(pakistanCnicSchema.parse(" 35202 1234567 1 "), "35202-1234567-1");
  for (const value of ["00000-0000000-0", "0000000000000", "11111-1111111-1", "99999-9999999-9", "02345-1234567-1", "92345-1234567-1", "35202-0000000-1", "12345-67890-123", "35202-123456-1", "35202-1234567-12", "3520A-1234567-1", "1234567890123"]) {
    assert.ok(cnicPlausibilityError(value), value);
    assert.equal(pakistanCnicSchema.safeParse(value).success, false, value);
  }
  for (const prefix of ["1", "2", "3", "4", "5", "6", "7", "8"]) assert.equal(cnicPlausibilityError(`${prefix}5202-1234567-1`), null, prefix);
});

test("bank account numbers are digits only (6–24) or a checksum-valid PK IBAN", () => {
  assert.equal(normalizeAccountNumber("0123 4567 8901"), "012345678901");
  assert.equal(normalizeAccountNumber("1234-5678-90"), "1234567890");
  for (const value of ["12345", "ABCDEFGH", "1234567a90", "000000000", "1".repeat(25), ""]) assert.equal(normalizeAccountNumber(value), null, value);
  // Check digits computed independently (ISO 13616) for these test IBANs.
  for (const iban of ["PK36SCBL0000001123456702", "PK32MEZN0001234567891234", "pk72 habb 0012 3456 7890 1234"]) assert.equal(isValidPakistanIban(iban), true, iban);
  for (const iban of ["PK37SCBL0000001123456702", "PK36SCBL000000112345670", "GB82WEST12345698765432", "PK36SC1L0000001123456702"]) assert.equal(isValidPakistanIban(iban), false, iban);
  assert.equal(accountNumberSchema.parse("PK36 SCBL 0000 0011 2345 6702"), "PK36SCBL0000001123456702");
  assert.equal(optionalIbanSchema.parse(""), "");
  assert.equal(optionalIbanSchema.safeParse("PK00BAD").success, false);
  assert.equal(maskAccount("PK36SCBL0000001123456702"), "••••6702");
});

test("pricing: sale > 0, original optional, original >= sale; NaN/Infinity/negatives rejected", () => {
  assert.equal(productPricingError(4000, 5000), null);
  assert.equal(productPricingError(4000, 4000), null);
  assert.equal(productPricingError(4000, null), null);
  assert.equal(productPricingError(5000, 3000), ORIGINAL_BELOW_SALE_ERROR);
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 100_000_000]) assert.equal(productPricingError(price, null), PRICE_ERROR, String(price));
  assert.ok(productPricingError(100, -5));
  assert.ok(productPricingError(100, Number.NaN));
});

test("discounts are calculated only from valid prices", () => {
  assert.equal(computeDiscountPercent(4000, 5000), 20);
  assert.equal(computeDiscountPercent(5000, 3000), 0);
  assert.deepEqual(displayDiscount(4000, 5000), { percent: 20, original: 5000 });
  assert.equal(displayDiscount(5000, 3000), null);
  assert.equal(displayDiscount(4000, 4000), null);
});

test("vendor product APIs reject an original price below the sale price, including partial updates", () => {
  const base = { productName: "Shirt", description: "Cotton", price: 5000, category: "Clothing", stock: 3, images: ["/uploads/vendor-products/a.jpg"] };
  assert.equal(vendorProductCreateSchema.safeParse({ ...base, originalPrice: 3000 }).success, false);
  assert.equal(vendorProductCreateSchema.safeParse({ ...base, originalPrice: 6000 }).success, true);
  assert.equal(vendorProductCreateSchema.safeParse({ ...base, price: -1 }).success, false);
  assert.equal(vendorProductUpdateSchema.safeParse({ price: 5000, originalPrice: 3000 }).success, false);
  assert.equal(mergedPricingError({ price: "4000", originalPrice: "5000" }, { price: 6000 }), ORIGINAL_BELOW_SALE_ERROR);
  assert.equal(mergedPricingError({ price: "4000", originalPrice: "5000" }, { originalPrice: null }), null);
});

test("admin product APIs validate types, prices, stock and variants", () => {
  const base = { name: "Cream", price: 4000, category: "Beauty" };
  const parsed = adminProductCreateSchema.parse({ ...base, originalPrice: 5000, variants: ["50ml"] });
  assert.equal(parsed.stock, 0);
  assert.equal(parsed.isActive, true);
  for (const bad of [{ ...base, price: "abc" }, { ...base, price: -5 }, { ...base, originalPrice: 3000 }, { ...base, stock: -1 }, { ...base, stock: 1.5 }, { ...base, isActive: "yes" }, { ...base, variants: "a,b" }, { price: 10, category: "x" }]) {
    assert.equal(adminProductCreateSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
  assert.equal(adminProductUpdateSchema.safeParse({ isActive: false }).success, true);
  assert.equal(adminProductUpdateSchema.safeParse({ stock: -2 }).success, false);
});

test("customer registration, addresses, profile and checkout enforce names and Pakistani mobiles on the server", () => {
  assert.equal(customerRegistrationInput.safeParse({ name: "12345", email: "a@b.pk", password: "secret1" }).success, false);
  assert.equal(customerRegistrationInput.parse({ name: "Ali Khan", email: "A@B.PK", password: "secret1", phone: "+92 300 1234567" }).phone, "0300-1234567");
  const address = { label: "Home", recipientName: "Ali Khan", phone: "03001234567", address: "12 Street", city: "Lahore" };
  assert.equal(addressSchema.parse(address).phone, "0300-1234567");
  assert.equal(addressSchema.safeParse({ ...address, phone: "+++++++" }).success, false);
  assert.equal(addressSchema.safeParse({ ...address, recipientName: "999" }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Ali", phone: "......." }).success, false);
  const checkout = { customerName: "Ali Khan", customerPhone: "+923001234567", customerAddress: "12 Street", city: "Lahore" };
  assert.equal(checkoutAddresses(checkout).shipping.phone, "0300-1234567");
  assert.throws(() => checkoutAddresses({ ...checkout, customerPhone: "abc" }), /mobile/i);
  assert.throws(() => checkoutAddresses({ ...checkout, customerName: "12345" }), /number/i);
  assert.throws(() => checkoutAddresses({ ...checkout, sameBillingAddress: false, billingAddress: { name: "Ali", address: "1 Road", city: "Lahore", phone: "letters" } }), /mobile/i);
});

test("vendor onboarding final schema enforces CNIC, names, account number and IBAN", () => {
  const complete = { shopName: "Test Store", category: "Other", phone: "03001234567", address: "123 Test Street", city: "Lahore", province: "Punjab", businessType: "individual", name: "Test Seller", cnic: "35202-1234567-1", pickupAddress: "123 Test Street", pickupCity: "Lahore", pickupProvince: "Punjab", pickupContactName: "Test Seller", pickupPhone: "03001234567", returnSameAsPickup: true, bankName: "HBL", accountTitle: "Test Seller", accountNumber: "12345678", declarationAccepted: true };
  assert.equal(vendorSetupSchema.safeParse(complete).success, true);
  for (const [key, value] of [["cnic", "00000-0000000-0"], ["name", "ABC123"], ["accountNumber", "abcdefgh"], ["iban", "PK00XXXX"], ["accountTitle", "123"], ["pickupContactName", "007"]] as const) {
    assert.equal(vendorSetupSchema.safeParse({ ...complete, [key]: value }).success, false, key);
  }
  assert.equal(vendorSetupFields.accountNumber.parse("PK36SCBL0000001123456702"), "PK36SCBL0000001123456702");
});
