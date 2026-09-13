import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { profileSchema } from "@/lib/customer-address-schema";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => { const c = await customerActor(); return prisma.customer.findUnique({ where: { id: c.id }, select: { name: true, email: true, phone: true, image: true, createdAt: true } }); }); }
export async function PATCH(request: Request) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); const data = profileSchema.parse(await request.json());
  return prisma.customer.update({ where: { id: c.id }, data, select: { name: true, email: true, phone: true } });
}); }