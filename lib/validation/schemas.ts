import { z } from "zod";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { cnicPlausibilityError, normalizePakistanCnic } from "@/lib/pakistan-cnic";
import { accountTitleError, normalizePersonName, personNameError } from "@/lib/validation/person-name";
import { ACCOUNT_NUMBER_ERROR, IBAN_ERROR, compactBankValue, isValidPakistanIban, normalizeAccountNumber } from "@/lib/validation/bank";

/**
 * Server-side zod schemas shared by every API that accepts these values. Each one strips HTML,
 * normalises the value and applies the same rule the browser shows (see the pure modules).
 */

export function personNameSchema(label = "Name") {
  return z.string().max(400).transform((value, ctx) => {
    const clean = normalizePersonName(sanitizePlainText(value, 400));
    const error = personNameError(clean, label);
    if (error) { ctx.addIssue({ code: "custom", message: error }); return z.NEVER; }
    return clean;
  });
}

/** Blank stays blank; anything else must be a valid person name. */
export function optionalPersonNameSchema(label = "Name") {
  return z.string().max(400).transform((value, ctx) => {
    const clean = normalizePersonName(sanitizePlainText(value, 400));
    if (!clean) return "";
    const error = personNameError(clean, label);
    if (error) { ctx.addIssue({ code: "custom", message: error }); return z.NEVER; }
    return clean;
  });
}

export const accountTitleSchema = z.string().max(400).transform((value, ctx) => {
  const clean = normalizePersonName(sanitizePlainText(value, 400));
  const error = accountTitleError(clean);
  if (error) { ctx.addIssue({ code: "custom", message: error }); return z.NEVER; }
  return clean;
});

/** Strict CNIC: 13 digits with or without dashes, returned as 00000-0000000-0. */
export const pakistanCnicSchema = z.string().max(40).transform((value, ctx) => {
  const clean = sanitizePlainText(value, 40);
  const normalized = normalizePakistanCnic(clean);
  if (normalized) return normalized;
  ctx.addIssue({ code: "custom", message: cnicPlausibilityError(clean) || "Use 00000-0000000-0." });
  return z.NEVER;
});

export const accountNumberSchema = z.string().max(64).transform((value, ctx) => {
  const normalized = normalizeAccountNumber(sanitizePlainText(value, 64));
  if (normalized) return normalized;
  ctx.addIssue({ code: "custom", message: ACCOUNT_NUMBER_ERROR });
  return z.NEVER;
});

export const optionalIbanSchema = z.string().max(64).transform((value, ctx) => {
  const compact = compactBankValue(sanitizePlainText(value, 64));
  if (!compact) return "";
  if (isValidPakistanIban(compact)) return compact;
  ctx.addIssue({ code: "custom", message: IBAN_ERROR });
  return z.NEVER;
});

export const bankNameSchema = z.string().max(200).transform((value, ctx) => {
  const clean = sanitizePlainText(value, 120).replace(/\s+/g, " ").trim();
  if ((clean.match(new RegExp("\\p{L}", "gu")) || []).length < 2 || !new RegExp("^[\\p{L}\\p{M}\\p{Nd} .&'()-]+$", "u").test(clean)) {
    ctx.addIssue({ code: "custom", message: "Choose or enter your bank's name." });
    return z.NEVER;
  }
  return clean;
});
