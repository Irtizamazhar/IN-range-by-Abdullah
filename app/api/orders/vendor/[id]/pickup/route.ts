export const dynamic = "force-dynamic";

import { z } from "zod";
import { api, sameOrigin } from "@/lib/marketplace-api";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import { pickupPrefill, requestPickup } from "@/lib/pickup-workflow";

type Ctx = { params: Promise<{ id: string }> };
const requestSchema = z.object({
  parcelCount: z.number().int().min(1).max(100), weightKg: z.number().positive().max(999999).optional(),
  preferredWindow: z.string().trim().max(255).optional(), instructions: z.string().trim().max(2000).optional(),
  packedConfirmed: z.literal(true),
});

export async function GET(_req: Request, ctx: Ctx) { return api(async () => {
  const auth = await requireApprovedVendorApi(); if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const order = await prisma.vendorShopOrder.findFirst({ where: { id, vendorId: auth.vendor.id }, select: { id: true, status: true } });
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  const pickup = await prisma.pickupRequest.findUnique({ where: { shopOrderId: id }, include: { visit: true } });
  return { orderStatus: order.status, prefill: await pickupPrefill(auth.vendor.id), pickup };
}); }

export async function POST(req: Request, ctx: Ctx) { return api(async () => {
  sameOrigin(req);
  const auth = await requireApprovedVendorApi(); if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const body = requestSchema.parse(await req.json());
  const pickup = await requestPickup({ shopOrderId: id, vendorId: auth.vendor.id, ...body });
  return { pickup };
}); }
