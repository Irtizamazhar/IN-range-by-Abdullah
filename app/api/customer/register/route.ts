export const dynamic = "force-dynamic";
import bcrypt from "bcryptjs";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {api,ApiError,sameOrigin} from "@/lib/marketplace-api";
import {sanitizePlainText} from "@/lib/security/sanitize";
import {consumeOrReject,createRegisterRateLimiter} from "@/lib/security/rate-limit";
const limiter=createRegisterRateLimiter();
const input=z.object({name:z.string().trim().min(1).max(200).transform(v=>sanitizePlainText(v,200)).pipe(z.string().min(1)),email:z.string().trim().toLowerCase().email().max(255),password:z.string().min(6).max(72).refine(v=>Buffer.byteLength(v,"utf8")<=72,"Password must be at most 72 bytes."),phone:z.string().trim().max(30).optional().default("")});
export async function POST(request:Request){return api(async()=>{
 sameOrigin(request);
 const rate=await consumeOrReject(limiter,"customer-register:"+(request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown"));if(!rate.ok)throw new ApiError(429,"Too many attempts. Please try again later.");
 const data=input.parse(await request.json());
 if(data.email===process.env.ADMIN_EMAIL?.trim().toLowerCase())throw new ApiError(400,"This email cannot be used for customer registration.");
 if(await prisma.customer.findUnique({where:{email:data.email},select:{id:true}}))throw new ApiError(409,"An account with this email already exists. Please sign in.");
 const {password,...profile}=data;await prisma.customer.create({data:{...profile,passwordHash:await bcrypt.hash(password,12)}});
 return {ok:true};
});}
