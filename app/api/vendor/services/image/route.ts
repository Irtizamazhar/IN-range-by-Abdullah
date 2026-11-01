import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { api } from "@/lib/marketplace-api";
import { uploadServiceImage } from "@/lib/service-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;
  return api(() => uploadServiceImage(request, `vendor-${auth.vendor.id}`));
}
