export const dynamic = "force-dynamic";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import {prisma} from "@/lib/prisma";
import {api,ApiError} from "@/lib/marketplace-api";
import {customerRegistrationSameOrigin} from "@/lib/customer-registration-origin";
import {consumeOrReject,createRegisterRateLimiter} from "@/lib/security/rate-limit";
import {customerRegistrationInput} from "@/lib/customer-registration-input";
import {sendMail,isMailConfigured} from "@/lib/mailer";
import {customerWelcomeEmail} from "@/lib/joro-email-templates";
const limiter=createRegisterRateLimiter();
export async function POST(request:Request){return api(async()=>{
 customerRegistrationSameOrigin(request);
 const rate=await consumeOrReject(limiter,"customer-register:"+(request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown"));if(!rate.ok)throw new ApiError(429,"Too many attempts. Please try again later.");
 const data=customerRegistrationInput.parse(await request.json());
 if(data.email===process.env.ADMIN_EMAIL?.trim().toLowerCase())throw new ApiError(400,"This email cannot be used for customer registration.");
 if(await prisma.customer.findUnique({where:{email:data.email},select:{id:true}}))throw new ApiError(409,"An account with this email already exists. Please sign in.");
 const {password,...profile}=data;await prisma.customer.create({data:{...profile,passwordHash:await bcrypt.hash(password,12),welcomeEligibleAt:new Date(),notifications:{create:{type:"WELCOME_ONBOARDING",title:"Welcome to JORO",message:"Your marketplace journey starts here.",link:"/",idempotencyKey:`customer-welcome:${createHash("sha256").update(data.email).digest("hex")}`}}}});
 let emailDelivery:"accepted"|"failed"|"not_configured"="not_configured";
 if(isMailConfigured()){
  try{emailDelivery=await sendMail({to:data.email,...customerWelcomeEmail(data.name)})?"accepted":"failed";}
  catch{emailDelivery="failed";}
 }
 return {ok:true,emailDelivery};
});}
