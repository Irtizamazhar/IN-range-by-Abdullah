import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { wantInput } from "@/lib/want-schema";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(_request: Request, { params }: Context) { return api(async () => {
  const want = await prisma.want.findUnique({ where: { id: params.id }, select: { id: true, customerId: true, title: true, category: true, city: true, budgetMin: true, budgetMax: true, budgetFlexible: true, quantity: true, description: true, condition: true, status: true, expiresAt: true, createdAt: true, _count: { select: { interests: true } } } });
  if (!want) throw new ApiError(404, "Want not found.");
  if (want.status !== "OPEN" || want.expiresAt <= new Date()) { const customer = await customerActor(); if (customer.id !== want.customerId) throw new ApiError(404, "Want unavailable."); }
  const { customerId, ...publicWant } = want; void customerId; return { want: publicWant };
}); }
export async function PATCH(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const customer = await customerActor(); const body = await request.json();
  return prisma.$transaction(async tx => {
    const want = await tx.want.findFirst({ where: { id: params.id, customerId: customer.id } });
    if (!want) throw new ApiError(404, "Want not found.");
    if (["FULFILLED", "EXPIRED", "CLOSED"].includes(want.status)) throw new ApiError(409, "This Want is no longer editable.");
    if (body.action === "close") return { want: await tx.want.update({ where: { id: want.id }, data: { status: "CLOSED" } }) };
    const { draft, ...data } = wantInput.parse(body);
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : want.expiresAt;
    if (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 90 * 86400000) throw new ApiError(400, "Invalid expiry.");
    return { want: await tx.want.update({ where: { id: want.id }, data: { ...data, expiresAt, status: draft ? "DRAFT" : "PENDING_MODERATION", moderationReason: null } }) };
  }, { isolationLevel: "Serializable" });
}); }