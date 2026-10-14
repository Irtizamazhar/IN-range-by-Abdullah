import { RateLimiterMemory } from "rate-limiter-flexible";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { consumeOrReject } from "@/lib/security/rate-limit";
import { joinedCounts, publicWantWhere } from "@/lib/want-engagement";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
/** 30 join/leave changes per minute per customer. */
const limiter = new RateLimiterMemory({ points: 30, duration: 60 });
export async function GET(_request: Request, { params }: Context) { return api(async () => {
  const customer = await customerActor();
  return { joined: !!await prisma.wantInterest.findUnique({ where: { customerId_wantId: { customerId: customer.id, wantId: params.id } }, select: { id: true } }) };
}); }
/**
 * Customer-only (vendor sessions are rejected by customerActor). Joining needs a public, open Want and never
 * grants access to anyone's offers; leaving works even after the Want closes.
 */
async function change(request: Request, wantId: string, joined: boolean) { return api(async () => {
  sameOrigin(request); const customer = await customerActor();
  const limit = await consumeOrReject(limiter, `want-join:${customer.id}`);
  if (!limit.ok) throw new ApiError(429, "You're doing that too quickly. Please wait a moment.");
  const result = await prisma.$transaction(async tx => {
    const want = await tx.want.findFirst({ where: { id: wantId, ...(joined ? publicWantWhere() : {}) }, select: { id: true, customerId: true } });
    if (!want) throw new ApiError(404, joined ? "This Want is closed or no longer available." : "Want unavailable.");
    if (joined && want.customerId === customer.id) throw new ApiError(400, "You can't join your own Want.");
    if (joined) await tx.wantInterest.createMany({ data: [{ customerId: customer.id, wantId }], skipDuplicates: true });
    else await tx.wantInterest.deleteMany({ where: { customerId: customer.id, wantId } });
    return { joined };
  }, { isolationLevel: "Serializable" });
  return { ...result, count: (await joinedCounts([wantId])).get(wantId) ?? 0 };
}); }
export async function PUT(request: Request, { params }: Context) { return change(request, params.id, true); }
export async function DELETE(request: Request, { params }: Context) { return change(request, params.id, false); }
