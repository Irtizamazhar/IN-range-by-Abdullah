import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { LogoMark } from "@/components/user/LogoMark";
export const dynamic="force-dynamic";
export default async function Page(){
 const session=await getVendorFromSession({allowUnapproved:true});
 if(!session)redirect("/login?role=vendor&mode=signin");
 const {vendor}=session;
 if(vendor.status==="onboarding")redirect("/vendor/onboarding");
 if(vendor.status==="approved")redirect("/vendor/dashboard");
 return <main className="min-h-dvh bg-[#f5f7f2] px-5 py-12"><section className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm"><LogoMark href="/" /><p className="mt-2 text-xs font-bold text-emerald-800">APNI MARKET • APNI CHOICE</p><p className="mt-8 text-sm font-semibold capitalize text-emerald-800">{vendor.status} application</p><h1 className="mt-2 text-3xl font-bold">Your seller application</h1><p className="mt-4 leading-7 text-neutral-600">{vendor.status==="pending"?"Your details have been submitted for admin review. Your seller dashboard becomes available after approval.":"Your seller access is currently restricted. Contact support or use the existing appeal flow."}</p>{!vendor.isEmailVerified && <p className="mt-4 text-sm">Check your inbox to verify your email. <Link href="/vendor/verify-email" className="font-bold text-emerald-800 underline">Resend verification</Link></p>}<div className="mt-7 flex flex-wrap gap-4"><Link href="/login?role=vendor&mode=signin" className="rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white">My seller account</Link><Link href="/" className="rounded-xl border px-5 py-3 font-bold">Continue shopping</Link></div></section></main>;
}
