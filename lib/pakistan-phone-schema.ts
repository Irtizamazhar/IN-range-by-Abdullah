import { z } from "zod";
import { normalizePakistanMobile, PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";

export const pakistanMobileSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePakistanMobile(value);
  if (normalized !== null) return normalized;

  ctx.addIssue({ code: "custom", message: PAKISTAN_MOBILE_ERROR });
  return z.NEVER;
});

export const optionalPakistanMobileSchema = z.string().transform((value, ctx) => {
  if (!value.trim()) return "";

  const normalized = normalizePakistanMobile(value);
  if (normalized !== null) return normalized;

  ctx.addIssue({ code: "custom", message: PAKISTAN_MOBILE_ERROR });
  return z.NEVER;
}).optional().default("");
