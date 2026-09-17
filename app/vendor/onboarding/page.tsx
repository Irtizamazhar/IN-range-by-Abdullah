import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { VendorOnboardingForm } from "@/components/vendor/VendorOnboardingForm";
export const dynamic = "force-dynamic";
export default async function Page(){
 const session=await getVendorFromSession({allowUnapproved:true});
 if(!session)redirect("/login?role=vendor&mode=signin");
 if(!["onboarding","rejected"].includes(session.vendor.status))redirect(session.vendor.status==="approved"?"/vendor/dashboard":"/vendor/status");
 return <VendorOnboardingForm />;
}
