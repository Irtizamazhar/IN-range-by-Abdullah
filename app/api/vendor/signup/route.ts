import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { api, ApiError } from "@/lib/marketplace-api";
import { vendorRegistrationSameOrigin } from "@/lib/vendor-registration-origin";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { consumeOrReject, createRegisterRateLimiter } from "@/lib/security/rate-limit";
import { pakistanMobileSchema } from "@/lib/pakistan-phone-schema";
import {isMailConfigured,sendMail} from "@/lib/mailer";
import {vendorWelcomeEmail} from "@/lib/joro-email-templates";
export const dynamic = "force-dynamic";
const limiter = createRegisterRateLimiter();
const input = z.object({ phone: pakistanMobileSchema, name: z.string().max(200).transform(v=>sanitizePlainText(v,200)).pipe(z.string().min(1)), email: z.string().trim().email().max(255).transform(v=>v.toLowerCase()), password: z.string().min(8).max(72).refine(v=>Buffer.byteLength(v,"utf8")<=72,"Password is too long") });
export async function POST(request: Request) { return api(async()=>{
  vendorRegistrationSameOrigin(request);
  const limited = await consumeOrReject(limiter, `vendor-basic:${request.headers.get("x-forwarded-for")?.split(",")[0] || "local"}`);
  if (!limited.ok) throw new ApiError(429,"Too many attempts. Try again later.");
  const body = input.parse(await request.json());
  if (await prisma.vendor.findUnique({where:{email:body.email},select:{id:true}})) throw new ApiError(409,"A seller account already exists. Please sign in.");
  await prisma.vendor.create({data:{ownerName:body.name,email:body.email,phone:body.phone,passwordHash:await bcrypt.hash(body.password,12),address:"",status:"onboarding"},select:{id:true}});
  let emailDelivery:"accepted"|"failed"|"not_configured"="not_configured";
  if(isMailConfigured()){
    try{emailDelivery=await sendMail({to:body.email,...vendorWelcomeEmail(body.name)})?"accepted":"failed";}
    catch{emailDelivery="failed";}
  }
  return {ok:true,next:"/vendor/onboarding",emailDelivery};
}); }
