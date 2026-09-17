import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorEntry } from "@/lib/vendor-entry";
export const dynamic = "force-dynamic";
export default async function SellPage() {
 const session = await getVendorFromSession({allowUnapproved:true});
 redirect(vendorEntry(session?.vendor.status).href);
}
