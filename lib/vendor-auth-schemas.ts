import { z } from "zod";

const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
const phonePattern = /^03\d{2}-\d{7}$/;

const trimString = (val: unknown) =>
  typeof val === "string" ? val.trim() : val;

/** Multipart registration: fields only (files validated separately). */
export const vendorRegisterFormFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  password: z.preprocess(trimString, z.string().min(8).max(128)),
  phone: z.string().regex(phonePattern, "Use format 03XX-XXXXXXX"),
  city: z.string().min(1).max(120),
  address: z.string().min(5).max(2000),
  shopName: z.string().min(1).max(200),
  businessType: z.enum(["individual", "company"]),
  businessRegNo: z.string().max(120).optional().nullable(),
  cnic: z.string().regex(cnicPattern, "Use format 00000-0000000-0"),
  category: z.string().min(1).max(100),
  bankName: z.string().min(1).max(120),
  accountTitle: z.string().min(1).max(200),
  accountNumber: z.string().min(5).max(40),
});

export type VendorRegisterFormFields = z.infer<
  typeof vendorRegisterFormFieldsSchema
>;

export const vendorLoginBodySchema = z.object({
  email: z.string().email().max(255),
  /** Not trimmed here — login route tries raw then trimmed for bcrypt compatibility. */
  password: z.string().min(1).max(128),
  /** Longer JWT/cookie when true (see vendor login API). */
  rememberMe: z.boolean().optional().default(false),
});

export const vendorResendBodySchema = z.object({
  email: z.string().email().max(255),
});
