import { api, ApiError, customerActor } from "@/lib/marketplace-api";
import { CUSTOMER_RESOURCE_TYPES, listOwnResources } from "@/lib/support-service";
export const dynamic = "force-dynamic";

export async function GET(request: Request) { return api(async () => {
  const customer = await customerActor();
  const type = new URL(request.url).searchParams.get("type") || "";
  if (!CUSTOMER_RESOURCE_TYPES.includes(type as (typeof CUSTOMER_RESOURCE_TYPES)[number])) throw new ApiError(400, "Unknown resource type.");
  return { resources: await listOwnResources("CUSTOMER", customer.id, type) };
}); }
