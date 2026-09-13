import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(_request: Request, { params }: Context) { return api(async () => {
  const customer = await customerActor();
  return { joined: !!await prisma.wantInterest.findUnique({ where: { customerId_wantId: { customerId: customer.id, wantId: params.id } }, select: { id: true } }) };
}); }
async function change(request: Request, wantId: string, joined: boolean) { return api(async () => {
  sameOrigin(request); const customer = await customerActor();
  return prisma.$transaction(async tx => {
    const want = await tx.want.findFirst({ where: { id: wantId, ...(joined ? { status: "OPEN" as const, expiresAt: { gt: new Date() } } : {}) }, select: { id: true, customerId: true } });
    if (!want) throw new ApiError(404, "Want unavailable.");
    if (joined && want.customerId === customer.id) throw new ApiError(400, "You can't express interest in your own Want.");
    if (joined) await tx.wantInterest.createMany({ data: [{ customerId: customer.id, wantId }], skipDuplicates: true });
    else await tx.wantInterest.deleteMany({ where: { customerId: customer.id, wantId } });
    return { joined, count: await tx.wantInterest.count({ where: { wantId } }) };
  }, { isolationLevel: "Serializable" });
}); }
export async function PUT(request: Request, { params }: Context) { return change(request, params.id, true); }
export async function DELETE(request: Request, { params }: Context) { return change(request, params.id, false); }