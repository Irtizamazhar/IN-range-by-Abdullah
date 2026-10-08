import test from "node:test";
import assert from "node:assert/strict";
import { formatPakistanMobileInput, normalizePakistanMobile, pakistanMobileInputMaxLength } from "../lib/pakistan-phone";
import { pakistanMobileSchema } from "../lib/pakistan-phone-schema";
import { vendorRegisterFormFieldsSchema } from "../lib/vendor-auth-schemas";
import { vendorSetupSchema } from "../lib/vendor-onboarding-schema";

const canonicalPhone = "0300-1234567";
const acceptedPhones = [
  canonicalPhone,
  "03001234567",
  "0300 1234567",
  "+923001234567",
  "+92 300 1234567",
  "+92-300-1234567",
  "00923001234567",
  "0092 300 1234567",
  "923001234567",
  "92-300-1234567",
  "  +92 300 1234567  ",
];
const invalidPhones = [
  "",
  "   ",
  "0300",
  "0300-123456",
  "0300-12345678",
  "+92 300 123456",
  "+92 300 12345678",
  "0300-1234567abc",
  "phone03001234567",
  "03O0-1234567",
  "0300.1234567",
  "+91 300 1234567",
  "+1 300 1234567",
  "021-12345678",
  "+92 21 12345678",
  "3001234567",
  "+92+3001234567",
  "++923001234567",
  "923001234567+",
  "0300-1234567 ext 5",
  "0300-1234567/0300-7654321",
];

const registration = {
  name: "Test Seller",
  email: "seller@example.test",
  password: "Synthetic-test-password-123",
  phone: canonicalPhone,
  city: "Lahore",
  address: "123 Test Street",
  shopName: "Test Store",
  businessType: "individual",
  cnic: "12345-1234567-1",
  category: "Electronics",
  bankName: "Test Bank",
  accountTitle: "Test Seller",
  accountNumber: "123456789",
};

const onboarding = {
  ...registration,
  storeSlug: "phone-fixture-store",
  shopDescription: "A synthetic store for phone validation tests.",
  province: "Punjab",
  pickupAddress: "123 Test Street",
  pickupCity: "Lahore",
  pickupProvince: "Punjab",
  pickupContactName: "Test Seller",
  pickupPhone: canonicalPhone,
  returnSameAsPickup: true,
  declarationAccepted: true,
};

const separateReturn = {
  returnSameAsPickup: false,
  returnAddress: "456 Return Street",
  returnCity: "Lahore",
  returnProvince: "Punjab",
  returnContactName: "Test Returns Contact",
};

test("local mobile input gains a dash as subscriber digits are typed", () => {
  const typed = ["", "0", "03", "032", "0324", "03241", "032412", "03241234567"];
  const formatted = ["", "0", "03", "032", "0324", "0324-1", "0324-12", "0324-1234567"];
  typed.forEach((value, index) => assert.equal(formatPakistanMobileInput(value), formatted[index]));

  let input = "";
  for (const digit of "03241234567") input = formatPakistanMobileInput(input + digit);
  assert.equal(input, "0324-1234567");
});

test("international mobile input groups country, operator and subscriber as typed", () => {
  for (const prefix of ["+92", "0092", "92"]) {
    for (let length = 0; length <= prefix.length; length++) {
      const partialPrefix = prefix.slice(0, length);
      assert.equal(formatPakistanMobileInput(partialPrefix), partialPrefix);
    }
    const cases = [
      ["3", `${prefix}-3`],
      ["30", `${prefix}-30`],
      ["300", `${prefix}-300`],
      ["3001", `${prefix}-300-1`],
      ["3001234567", `${prefix}-300-1234567`],
    ];
    for (const [mobile, expected] of cases) {
      assert.equal(formatPakistanMobileInput(prefix + mobile), expected);
    }
    let input = "";
    for (const digit of `${prefix}3001234567`) input = formatPakistanMobileInput(input + digit);
    assert.equal(input, `${prefix}-300-1234567`);
  }
});

test("pasted accepted phone formats retain their prefix and format idempotently", () => {
  for (const value of acceptedPhones) {
    const digits = value.replace(/[ -]/g, "");
    const prefix = ["+92", "0092", "92"].find(item => digits.startsWith(item));
    const expected = prefix ? `${prefix}-300-1234567` : canonicalPhone;
    const formatted = formatPakistanMobileInput(value);
    assert.equal(formatted, expected, value);
    assert.equal(formatPakistanMobileInput(formatted), formatted, value);
    assert.equal(normalizePakistanMobile(formatted), canonicalPhone, value);
  }
});

test("backspacing can remove subscriber digits, operator digits and country prefixes", () => {
  for (const initial of ["0324-1234567", "+92-300-1234567", "0092-300-1234567", "92-300-1234567"]) {
    let value = initial;
    while (value) {
      const next = formatPakistanMobileInput(value.slice(0, -1));
      assert.equal(next.replace(/-/g, ""), value.replace(/-/g, "").slice(0, -1));
      assert.equal(next.endsWith("-"), false);
      assert.equal(formatPakistanMobileInput(next), next);
      value = next;
    }
  }
  assert.equal(formatPakistanMobileInput("0324-"), "0324");
  assert.equal(formatPakistanMobileInput("+92-"), "+92");
  assert.equal(formatPakistanMobileInput("+92-300-"), "+92-300");
});

test("formatting preserves invalid characters, malformed plus signs and foreign numbers", () => {
  for (const value of [
    "0324a1234567", "phone03001234567", "03O0-1234567", "0300.1234567",
    "0300-1234567 ext 5", "0300-1234567/0300-7654321", "+92+3001234567",
    "++923001234567", "923001234567+", "+-923001234567", "-03001234567",
    "+91 300 1234567", "+1 300 1234567",
    "021-12345678", "+92 21 12345678", "3001234567", "  0300abc  ",
  ]) {
    assert.equal(formatPakistanMobileInput(value), value);
    assert.equal(normalizePakistanMobile(formatPakistanMobileInput(value)), null);
  }
});

test("typing and pasting stop at the supported mobile digit count", () => {
  for (const [value, expected] of [
    ["03001234567", canonicalPhone],
    ["+923001234567", "+92-300-1234567"],
    ["00923001234567", "0092-300-1234567"],
    ["923001234567", "92-300-1234567"],
  ]) {
    for (const suffix of ["8", "8901234567890"]) {
      assert.equal(formatPakistanMobileInput(value + suffix), expected);
      assert.equal(formatPakistanMobileInput(expected + suffix), expected);
    }
    let input = "";
    for (const digit of value + "8901234567890") input = formatPakistanMobileInput(input + digit);
    assert.equal(input, expected);
    assert.equal(formatPakistanMobileInput(input), input);
    assert.equal(input.length, pakistanMobileInputMaxLength(input));
  }
});

test("phone input limits include dashes and allow incomplete country prefixes", () => {
  for (const [input, expected] of [
    ["03", 12], ["0300-1234567", 12], ["+92", 15], ["+92-300-1234567", 15],
    ["0092", 16], ["0092-300-1234567", 16], ["92", 14], ["92-300-1234567", 14],
  ] as const) {
    assert.equal(pakistanMobileInputMaxLength(input), expected);
  }
  for (const input of ["", "0", "00", "009", "+", "+9", "9", "+91", "021", "0300abc", "+92+300"]) {
    assert.equal(pakistanMobileInputMaxLength(input), 16);
  }
});

test("backend phone validation still rejects overlong raw or formatted submissions", () => {
  for (const phone of [
    "030012345678", "0300-12345678", "+9230012345678", "+92-300-12345678",
    "009230012345678", "0092-300-12345678", "9230012345678", "92-300-12345678",
  ]) {
    assert.equal(normalizePakistanMobile(phone), null);
    assert.equal(pakistanMobileSchema.safeParse(phone).success, false);
    assert.equal(vendorRegisterFormFieldsSchema.safeParse({ ...registration, phone }).success, false);
    assert.equal(vendorSetupSchema.safeParse({ ...onboarding, phone }).success, false);
  }
});

test("phone formatting does not turn incomplete numbers into valid ones", () => {
  for (const value of ["0324123456", "+92300123456", "0092300123456", "92300123456"]) {
    const formatted = formatPakistanMobileInput(value);
    assert.equal(formatted.replace(/-/g, ""), value);
    assert.equal(normalizePakistanMobile(formatted), null);
  }
});

test("local and international Pakistan mobile formats normalize to the existing stored format", () => {
  for (const input of acceptedPhones) {
    assert.equal(normalizePakistanMobile(input), canonicalPhone, input);
    assert.equal(pakistanMobileSchema.parse(input), canonicalPhone, input);
  }
});

test("mobile normalization is idempotent and preserves valid subscriber digits", () => {
  for (const input of ["0311-7654321", "0333-0000000", "0345-9876543"]) {
    assert.equal(normalizePakistanMobile(input), input);
    assert.equal(normalizePakistanMobile(normalizePakistanMobile(input)!), input);
  }
  for (const input of acceptedPhones) {
    assert.equal(normalizePakistanMobile(normalizePakistanMobile(input)!), canonicalPhone);
  }
});

test("invalid, incomplete, foreign and non-mobile input cannot normalize into a valid phone", () => {
  for (const input of invalidPhones) {
    assert.equal(normalizePakistanMobile(input), null, input);
    assert.equal(pakistanMobileSchema.safeParse(input).success, false, input);
  }
  for (const input of [null, undefined, 3001234567, {}, []]) {
    assert.equal(pakistanMobileSchema.safeParse(input).success, false);
  }
});

test("legacy vendor registration accepts the same phone formats and stores the canonical value", () => {
  for (const phone of acceptedPhones) {
    assert.equal(vendorRegisterFormFieldsSchema.parse({ ...registration, phone }).phone, canonicalPhone, phone);
  }
});

test("legacy vendor registration reports invalid phones on the phone field", () => {
  for (const phone of invalidPhones) {
    const result = vendorRegisterFormFieldsSchema.safeParse({ ...registration, phone });
    assert.equal(result.success, false, phone);
    if (!result.success) assert.ok(result.error.issues.some(issue => issue.path[0] === "phone"), phone);
  }
});

test("onboarding normalizes seller and pickup phones independently", () => {
  for (const phone of acceptedPhones) {
    const result = vendorSetupSchema.parse({ ...onboarding, phone, pickupPhone: "+92 311 7654321" });
    assert.equal(result.phone, canonicalPhone, phone);
    assert.equal(result.pickupPhone, "0311-7654321", phone);
  }
});

test("onboarding requires valid seller and pickup phones", () => {
  for (const field of ["phone", "pickupPhone"] as const) {
    for (const phone of [undefined, ...invalidPhones]) {
      const result = vendorSetupSchema.safeParse({ ...onboarding, [field]: phone });
      assert.equal(result.success, false, `${field}: ${phone}`);
      if (!result.success) assert.ok(result.error.issues.some(issue => issue.path[0] === field), `${field}: ${phone}`);
    }
  }
});

test("onboarding allows an omitted or blank return phone when pickup details are reused", () => {
  for (const returnPhone of [undefined, "", "   "]) {
    const result = vendorSetupSchema.parse({ ...onboarding, returnPhone });
    assert.equal(result.returnPhone, "");
  }
});

test("a separate return address requires a valid phone and normalizes accepted formats", () => {
  for (const returnPhone of [undefined, ...invalidPhones]) {
    const result = vendorSetupSchema.safeParse({ ...onboarding, ...separateReturn, returnPhone });
    assert.equal(result.success, false, String(returnPhone));
    if (!result.success) assert.ok(result.error.issues.some(issue => issue.path[0] === "returnPhone"), String(returnPhone));
  }
  for (const returnPhone of acceptedPhones) {
    const result = vendorSetupSchema.parse({ ...onboarding, ...separateReturn, returnPhone });
    assert.equal(result.returnPhone, canonicalPhone, returnPhone);
  }
});

test("a populated optional return phone must also be valid and is normalized", () => {
  const result = vendorSetupSchema.parse({ ...onboarding, returnPhone: "+92 300 1234567" });
  assert.equal(result.returnPhone, canonicalPhone);
  for (const returnPhone of invalidPhones.filter(phone => phone.trim())) {
    const invalid = vendorSetupSchema.safeParse({ ...onboarding, returnPhone });
    assert.equal(invalid.success, false, returnPhone);
    if (!invalid.success) assert.ok(invalid.error.issues.some(issue => issue.path[0] === "returnPhone"), returnPhone);
  }
});
