import test from "node:test";
import assert from "node:assert/strict";
import { formatPakistanCnicInput, MAX_PAKISTAN_CNIC_LENGTH } from "../lib/pakistan-cnic";
import { vendorSetupFields } from "../lib/vendor-onboarding-schema";
import { vendorRegisterFormFieldsSchema } from "../lib/vendor-auth-schemas";

const rawCnic = "1234512345671";
const canonicalCnic = "12345-1234567-1";

test("CNIC dashes appear as the following digit is typed", () => {
  const expected = [
    "", "1", "12", "123", "1234", "12345", "12345-1", "12345-12",
    "12345-123", "12345-1234", "12345-12345", "12345-123456",
    "12345-1234567", canonicalCnic,
  ];
  let input = "";
  assert.equal(formatPakistanCnicInput(input), expected[0]);
  for (let index = 0; index < rawCnic.length; index++) {
    input = formatPakistanCnicInput(input + rawCnic[index]);
    assert.equal(input, expected[index + 1]);
    assert.equal(formatPakistanCnicInput(rawCnic.slice(0, index + 1)), expected[index + 1]);
  }
});

test("raw, formatted and spaced CNIC pastes produce the same idempotent result", () => {
  for (const value of [rawCnic, canonicalCnic, "12345 1234567 1", "  12345-1234567-1  "]) {
    const formatted = formatPakistanCnicInput(value);
    assert.equal(formatted, canonicalCnic);
    assert.equal(formatPakistanCnicInput(formatted), formatted);
  }
});

test("CNIC formatting retains leading zeros in every group", () => {
  for (const [input, expected] of [
    ["0123401234560", "01234-0123456-0"],
    ["0000000000000", "00000-0000000-0"],
    ["00000", "00000"],
    ["000000", "00000-0"],
  ]) {
    assert.equal(formatPakistanCnicInput(input), expected);
    assert.equal(formatPakistanCnicInput(expected), expected);
  }
});

test("progressive backspace can clear every CNIC digit without leaving a trailing dash", () => {
  let value = canonicalCnic;
  while (value) {
    const next = formatPakistanCnicInput(value.slice(0, -1));
    assert.equal(next.replace(/-/g, ""), value.replace(/-/g, "").slice(0, -1));
    assert.equal(next.endsWith("-"), false);
    assert.equal(formatPakistanCnicInput(next), next);
    value = next;
  }
  assert.equal(formatPakistanCnicInput("12345-"), "12345");
  assert.equal(formatPakistanCnicInput("12345-1234567-"), "12345-1234567");
  assert.equal(formatPakistanCnicInput("   "), "");
});

test("unsupported CNIC characters remain visible instead of being silently removed", () => {
  for (const value of [
    "12345a12345671", "CNIC1234512345671", "12345-1234567-X", "12345.1234567.1",
    "+1234512345671", "-1234512345671", "12345/1234567/1", "  12345abc  ",
    "12345\n12345671", "12345_1234567_1",
  ]) {
    assert.equal(formatPakistanCnicInput(value), value);
    assert.equal(vendorSetupFields.cnic.safeParse(formatPakistanCnicInput(value)).success, false);
  }
});

test("typing and pasting stop after thirteen CNIC digits", () => {
  for (const value of ["12345123456712", "12345-1234567-1234567890"]) {
    const formatted = formatPakistanCnicInput(value);
    assert.equal(formatted, canonicalCnic);
    assert.equal(formatted.length, MAX_PAKISTAN_CNIC_LENGTH);
    assert.equal(formatPakistanCnicInput(formatted), formatted);
  }
  let input = "";
  for (const digit of rawCnic + "234567890") input = formatPakistanCnicInput(input + digit);
  assert.equal(input, canonicalCnic);
  assert.equal(formatPakistanCnicInput("0123401234560123"), "01234-0123456-0");
});

test("backend CNIC validation still rejects overlong raw or formatted submissions", () => {
  for (const value of ["12345123456712", "12345-1234567-12", "12345-1234567-1234567890"]) {
    assert.equal(vendorSetupFields.cnic.safeParse(value).success, false);
    assert.equal(vendorRegisterFormFieldsSchema.shape.cnic.safeParse(value).success, false);
  }
});

test("formatted complete CNICs satisfy existing onboarding and registration validation", () => {
  const formatted = formatPakistanCnicInput(rawCnic);
  assert.equal(vendorSetupFields.cnic.parse(formatted), canonicalCnic);
  assert.equal(vendorRegisterFormFieldsSchema.shape.cnic.parse(formatted), canonicalCnic);

  for (let length = 0; length < rawCnic.length; length++) {
    const partial = formatPakistanCnicInput(rawCnic.slice(0, length));
    assert.equal(vendorSetupFields.cnic.safeParse(partial).success, false);
    assert.equal(vendorRegisterFormFieldsSchema.shape.cnic.safeParse(partial).success, false);
  }
});
