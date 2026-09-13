import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function DELETE(request: Request, { params }: { params: { productId: string } }) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); await prisma.savedProduct.deleteMany({ where: { customerId: c.id, productId: params.productId } }); return { ok: true, saved: false };
}); }