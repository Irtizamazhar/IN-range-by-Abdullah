import { z } from "zod";
import { isReservedOrInvalidSlug } from "@/lib/store-slug";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";
import { optionalPakistanMobileSchema, pakistanMobileSchema } from "@/lib/pakistan-phone-schema";
import { accountNumberSchema, accountTitleSchema, bankNameSchema, optionalIbanSchema, optionalPersonNameSchema, pakistanCnicSchema, personNameSchema } from "@/lib/validation/schemas";

const text = (max: number) => z.string().trim().max(max).transform(value => sanitizePlainText(value, max));
const phone = pakistanMobileSchema;
const required = (max: number, min = 1) => text(max).pipe(z.string().min(min, "This field is required."));
const bool = z.preprocess(v => v === "true" ? true : v === "false" ? false : v, z.boolean());
const step = z.coerce.number().int().min(0).max(4);
export const vendorSetupFields = {
  name: personNameSchema("Full name"), phone, shopName: required(160),
  // The server assigns the slug from the store name; a supplied one must still be valid.
  storeSlug: text(80).pipe(z.string().refine(v => !v || !isReservedOrInvalidSlug(v), "Use a unique 3–80 character store slug with lowercase letters, numbers and hyphens.")).optional().default(""),
  shopDescription: text(5000).optional().default(""), businessType: z.enum(["individual", "company"]),
  businessRegNo: text(120).optional().default(""), businessLegalName: text(200).optional().default(""),
  taxNumber: text(32).optional().default(""), category: required(100),
  address: required(2000, 5), city: required(120), province: required(120), postalCode: text(20).optional().default(""),
  cnic: pakistanCnicSchema,
  pickupAddress: required(2000, 5), pickupCity: required(120), pickupProvince: required(120),
  pickupPostalCode: text(20).optional().default(""), pickupContactName: personNameSchema("Contact name"), pickupPhone: phone,
  returnSameAsPickup: bool.default(true), returnAddress: text(2000).optional().default(""),
  returnCity: text(120).optional().default(""), returnProvince: text(120).optional().default(""),
  returnPostalCode: text(20).optional().default(""), returnContactName: optionalPersonNameSchema("Contact name").optional().default(""),
  returnPhone: optionalPakistanMobileSchema, bankName: bankNameSchema, accountTitle: accountTitleSchema,
  accountNumber: accountNumberSchema, iban: optionalIbanSchema.optional().default(""),
  step: step.default(0), declarationAccepted: bool.default(false),
};
export const vendorSetupSchema = z.object(vendorSetupFields).superRefine((input, ctx) => {
  const issue = (key: string, message: string) => ctx.addIssue({code:"custom",path:[key],message});
  if (input.businessType === "company") {
    if (input.businessRegNo.length < 2) issue("businessRegNo", "Business registration number is required.");
    if (!input.businessLegalName) issue("businessLegalName", "Registered business name is required.");
  }
  if (!input.returnSameAsPickup) {
    for (const key of ["returnAddress","returnCity","returnProvince","returnContactName"] as const)
      if (!input[key]) issue(key, "Complete the separate return address.");
    if (!input.returnPhone) issue("returnPhone", PAKISTAN_MOBILE_ERROR);
  }
  if (!input.declarationAccepted) issue("declarationAccepted", "Confirm that your details are accurate before submitting.");
});
const draftStrings = {
  name:text(200),phone:text(20),shopName:text(160),storeSlug:text(80),shopDescription:text(5000),businessRegNo:text(120),
  businessLegalName:text(200),taxNumber:text(32),category:text(100),address:text(2000),city:text(120),province:text(120),
  postalCode:text(20),cnic:text(20),pickupAddress:text(2000),pickupCity:text(120),pickupProvince:text(120),
  pickupPostalCode:text(20),pickupContactName:text(200),pickupPhone:text(20),returnAddress:text(2000),
  returnCity:text(120),returnProvince:text(120),returnPostalCode:text(20),returnContactName:text(200),
  returnPhone:text(20),bankName:text(120),accountTitle:text(200),accountNumber:text(40),iban:text(34),
};
export const vendorSetupDraftSchema = z.object({...draftStrings,businessType:z.enum(["individual","company"]),
  returnSameAsPickup:bool,step,declarationAccepted:bool,
  // Set by the server from uploaded files, never from form fields.
  // partialRecord: one upload carries one name (z.record with enum keys would require all three).
  documentNames:z.partialRecord(z.enum(["cnic_front","cnic_back","license"]),text(120))}).partial();
export type VendorSetup = z.infer<typeof vendorSetupSchema>;
export type VendorSetupDraft = z.infer<typeof vendorSetupDraftSchema>;
export const SETUP_STEP_KEYS = [
  ["shopName", "storeSlug", "category", "shopDescription", "phone", "address", "city", "province", "postalCode", "businessType"],
  ["name", "cnic", "businessLegalName", "businessRegNo", "taxNumber"],
  ["pickupAddress", "pickupCity", "pickupProvince", "pickupPostalCode", "pickupContactName", "pickupPhone", "returnSameAsPickup", "returnAddress", "returnCity", "returnProvince", "returnPostalCode", "returnContactName", "returnPhone"],
  ["accountTitle", "bankName", "accountNumber", "iban"],
] as const;

/** Validate only the active step; future required fields must not block a draft. */
export function setupStepErrors(input: Record<string, unknown>, step: number): Record<string, string> {
  if (step === 4) {
    const result = vendorSetupSchema.safeParse(input);
    return result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message]));
  }
  const errors: Record<string, string> = {};
  for (const key of SETUP_STEP_KEYS[step] || []) {
    // A field that was never filled is treated as blank so it gets the normal "required" message.
    const value = input[key] === undefined && key !== "returnSameAsPickup" && key !== "businessType" ? "" : input[key];
    const result = vendorSetupFields[key].safeParse(value);
    if (!result.success) errors[key] = result.error.issues[0].message;
  }
  if (step === 1 && input.businessType === "company") {
    if (!String(input.businessLegalName || "").trim()) errors.businessLegalName = "Registered business name is required.";
    if (String(input.businessRegNo || "").trim().length < 2) errors.businessRegNo = "Business registration number is required.";
  }
  if (step === 2 && (input.returnSameAsPickup === false || input.returnSameAsPickup === "false")) {
    for (const key of ["returnAddress", "returnCity", "returnProvince", "returnContactName", "returnPhone"]) {
      if (!String(input[key] || "").trim()) errors[key] = "Complete the separate return address.";
    }
  }
  return errors;
}
export const PRIVATE_SETUP_KEYS = ["businessLegalName","taxNumber","province","postalCode","pickupAddress","pickupCity","pickupProvince","pickupPostalCode","pickupContactName","pickupPhone","returnSameAsPickup","returnAddress","returnCity","returnProvince","returnPostalCode","returnContactName","returnPhone","step","declarationAccepted"] as const;
