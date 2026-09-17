import { api, ApiError } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { VENDOR_RESOURCE_TYPES, listOwnResources } from "@/lib/support-service";
export const dynamic = "force-dynamic";

export async function GET(request: Request) { return api(async () => {
  const session = await getVendorFromSession();
  if (!session) throw new ApiError(401, "Please sign in as a vendor.");
  const type = new URL(request.url).searchParams.get("type") || "";
  if (!VENDOR_RESOURCE_TYPES.includes(type as (typeof VENDOR_RESOURCE_TYPES)[number])) throw new ApiError(400, "Unknown resource type.");
  return { resources: await listOwnResources("VENDOR", session.vendor.id, type) };
}); }
