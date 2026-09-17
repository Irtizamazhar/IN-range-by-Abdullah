import { z } from "zod";
import { isReservedOrInvalidSlug } from "@/lib/store-slug";
import { sanitizePlainText } from "@/lib/security/sanitize";

const text = (max: number) => z.string().trim().max(max).transform(value => sanitizePlainText(value, max));
const phone = text(20).pipe(z.string().regex(/^03\d{2}-\d{7}$/, "Use 03XX-XXXXXXX."));
const required = (max: number, min = 1) => text(max).pipe(z.string().min(min, "This field is required."));
const bool = z.preprocess(v => v === "true" ? true : v === "false" ? false : v, z.boolean());
const step = z.coerce.number().int().min(0).max(4);
export const vendorSetupFields = {
  name: required(200), phone, shopName: required(160),
  storeSlug: text(80).pipe(z.string().refine(v => !isReservedOrInvalidSlug(v), "Use a unique 3–80 character store slug with lowercase letters, numbers and hyphens.")),
  shopDescription: required(5000, 10), businessType: z.enum(["individual", "company"]),
  businessRegNo: text(120).optional().default(""), businessLegalName: text(200).optional().default(""),
  taxNumber: text(32).optional().default(""), category: required(100),
  address: required(2000, 5), city: required(120), province: required(120), postalCode: text(20).optional().default(""),
  cnic: text(20).pipe(z.string().regex(/^\d{5}-\d{7}-\d$/, "Use 00000-0000000-0.")),
  pickupAddress: required(2000, 5), pickupCity: required(120), pickupProvince: required(120),
  pickupPostalCode: text(20).optional().default(""), pickupContactName: required(200), pickupPhone: phone,
  returnSameAsPickup: bool.default(true), returnAddress: text(2000).optional().default(""),
  returnCity: text(120).optional().default(""), returnProvince: text(120).optional().default(""),
  returnPostalCode: text(20).optional().default(""), returnContactName: text(200).optional().default(""),
  returnPhone: text(20).optional().default(""), bankName: required(120), accountTitle: required(200),
  accountNumber: required(40, 5), iban: text(34).refine(v => !v || /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v), "Enter an IBAN without spaces, or leave it blank.").optional().default(""),
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
    if (!/^03\d{2}-\d{7}$/.test(input.returnPhone)) issue("returnPhone", "Use 03XX-XXXXXXX.");
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
  returnSameAsPickup:bool,step,declarationAccepted:bool}).partial();
export type VendorSetup = z.infer<typeof vendorSetupSchema>;
export type VendorSetupDraft = z.infer<typeof vendorSetupDraftSchema>;
export const PRIVATE_SETUP_KEYS = ["businessLegalName","taxNumber","province","postalCode","pickupAddress","pickupCity","pickupProvince","pickupPostalCode","pickupContactName","pickupPhone","returnSameAsPickup","returnAddress","returnCity","returnProvince","returnPostalCode","returnContactName","returnPhone","step","declarationAccepted"] as const;
