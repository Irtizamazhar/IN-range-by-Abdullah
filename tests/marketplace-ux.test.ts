import test from "node:test";
import assert from "node:assert/strict";
import { formatPakistanNational, pakistanNationalDigits, pakistanMobileStorageValue, mobileCaretPosition } from "../lib/pakistan-mobile-input";
import { normalizePakistanMobile } from "../lib/pakistan-phone";
import { PAKISTANI_CITIES } from "../lib/pakistani-cities";

test("fixed country-code UI accepts legacy local and international numbers without duplicate prefixes", () => {
  for (const value of ["03001234567", "0300-1234567", "+92 300-1234567", "0092 300 1234567", "923001234567", "3001234567"]) {
    assert.equal(pakistanNationalDigits(value), "3001234567");
    assert.equal(formatPakistanNational(value), "300-1234567");
    assert.equal(pakistanMobileStorageValue(value), "0300-1234567");
    assert.equal(normalizePakistanMobile(pakistanMobileStorageValue(value)), "0300-1234567");
  }
});

test("national mobile editing caps ten digits, supports empty/partial values and stable caret mapping", () => {
  assert.equal(formatPakistanNational("300123456789"), "300-1234567");
  assert.equal(pakistanMobileStorageValue(""), "");
  for (const value of ["3", "30", "300", "3001", "30012"]) assert.equal(pakistanNationalDigits(pakistanMobileStorageValue(value)), value);
  assert.equal(mobileCaretPosition("300-1234567", 0), 0);
  assert.equal(mobileCaretPosition("300-1234567", 3), 3);
  assert.equal(mobileCaretPosition("300-1234567", 4), 5);
  assert.equal(mobileCaretPosition("300-1234567", 10), 11);
  assert.equal(normalizePakistanMobile(pakistanMobileStorageValue("1234567890")), null);
});

test("Pakistan suggestions cover cities and regional towns, with no equivalent-name duplicates", () => {
  assert.ok(PAKISTANI_CITIES.length > 500);
  for (const city of ["Karachi", "Lahore", "Islamabad", "Multan", "Peshawar", "Quetta", "Skardu", "Gilgit", "Muzaffarabad", "Mirpur", "Khaplu", "Taxila"]) assert.ok(PAKISTANI_CITIES.includes(city), city);
  const normalized = PAKISTANI_CITIES.map(city => city.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  assert.equal(new Set(normalized).size, normalized.length);
});
