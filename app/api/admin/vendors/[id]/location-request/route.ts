import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { reviewInput, reviewLocationRequest } from "@/lib/vendor-location-request";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

/** Approve or reject a seller's pending registered-location change. Only approval writes city/address. */
export async function POST(request: Request, { params }: Context) {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request);
    const parsed = reviewInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message || "Invalid request.");
    return { success: true, request: await reviewLocationRequest(auth.admin.id, params.id, parsed.data) };
  });
}
