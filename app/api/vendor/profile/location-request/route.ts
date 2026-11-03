import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { createLocationRequest, locationRequestInput, publicLocationRequest } from "@/lib/vendor-location-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const session = await getVendorFromSession();
    if (!session) throw new ApiError(401, "Vendor sign-in required.");
    if (session.vendor.status !== "approved") throw new ApiError(403, "Approved vendor required.");
    const body = await request.json().catch(() => null);
    const parsed = locationRequestInput.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message]));
      throw new ApiError(400, parsed.error.issues[0]?.message || "Please check the highlighted fields.", fieldErrors);
    }
    return { success: true, locationRequest: publicLocationRequest(await createLocationRequest(session.vendor.id, parsed.data)) };
  });
}
