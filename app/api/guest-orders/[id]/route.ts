import { api, ApiError } from "@/lib/marketplace-api";
import { prisma } from "@/lib/prisma";
import { guestOwnerHash, ownsGuestOrder } from "@/lib/guest-checkout";
import { ORDER_INCLUDE_SERIALIZE } from "@/lib/prisma-order-includes";
import { serializeOrder } from "@/lib/serialize";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) { return api(async () => { const owner = guestOwnerHash(); if (!await ownsGuestOrder(params.id, owner)) throw new ApiError(404, "Order not found for this browser session."); const order = await prisma.order.findFirst({ where: { id: params.id, customerId: null }, include: ORDER_INCLUDE_SERIALIZE }); if (!order) throw new ApiError(404, "Order not found."); return serializeOrder(order); }); }
