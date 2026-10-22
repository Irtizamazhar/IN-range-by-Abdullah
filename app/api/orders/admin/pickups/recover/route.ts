export const dynamic = "force-dynamic";

import { z } from "zod";
import { api, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { recoverLegacyPickup } from "@/lib/pickup-workflow";

const schema = z.object({
  shopOrderId: z.string().min(1).max(191),
  pickupAddress: z.string().trim().min(10).max(2000),
  pickupCity: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(200),
  contactPhone: z.string().trim().min(10).max(30),
  parcelCount: z.number().int().min(1).max(100),
  reason: z.string().trim().min(10).max(2000),
  evidence: z.string().trim().min(10).max(2000),
  verifiedOrder: z.literal(true),
});

export async function POST(req: Request) {
  return api(async () => {
    sameOrigin(req);
    const auth = await requireAdminPermission("orders.manage");
    if ("response" in auth) return auth.response;
    const body = schema.parse(await req.json());
    const pickup = await recoverLegacyPickup({ ...body, adminId: auth.admin.id });
    return { pickup };
  });
}
