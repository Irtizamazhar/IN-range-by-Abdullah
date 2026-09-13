import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) { return api(async () => {
  const customer = await customerActor(); const quote = await prisma.offerQuote.findFirst({ where: { id: params.id, customerId: customer.id }, include: { revision: { select: { productId: true, price: true, quantity: true, shipping: true, product: { select: { name: true, stock: true } } } } } });
  if (!quote) throw new ApiError(404, "Quote not found."); return { quote };
}); }