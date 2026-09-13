import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(_request: Request, { params }: Context) {
  return api(async () => {
    const vendor = await prisma.vendor.findFirst({ where: { id: params.id, status: "approved" }, select: { id: true } });
    if (!vendor) throw new ApiError(404, "Store unavailable.");
    let following = false;
    try { const customer = await customerActor(); following = !!await prisma.storeFollow.findUnique({ where: { customerId_vendorId: { customerId: customer.id, vendorId: params.id } }, select: { id: true } }); } catch { /* anonymous viewer */ }
    const followers = await prisma.storeFollow.count({ where: { vendorId: params.id } });
    return { following, followers };
  });
}
async function change(request: Request, vendorId: string, following: boolean) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    return prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: vendorId, ...(following ? { status: "approved" as const } : {}) }, select: { id: true } });
      if (!vendor) throw new ApiError(404, "Store unavailable.");
      if (following) await tx.storeFollow.createMany({ data: [{ customerId: customer.id, vendorId }], skipDuplicates: true });
      else await tx.storeFollow.deleteMany({ where: { customerId: customer.id, vendorId } });
      return { following, followers: await tx.storeFollow.count({ where: { vendorId } }) };
    }, { isolationLevel: "Serializable" });
  });
}
export async function PUT(request: Request, { params }: Context) { return change(request, params.id, true); }
export async function DELETE(request: Request, { params }: Context) { return change(request, params.id, false); }
