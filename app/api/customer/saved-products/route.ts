import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { customerSavedProducts } from "@/lib/customer-saved-products";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(async () => {
  const c = await customerActor();
  if (new URL(request.url).searchParams.get("idsOnly") === "1") return { ids: (await prisma.savedProduct.findMany({ where: { customerId: c.id }, select: { productId: true } })).map(p => p.productId) };
  return { products: await customerSavedProducts(c.id) };
}); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); const { productId } = z.object({ productId: z.string().min(1).max(191) }).parse(await request.json());
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true, OR: [{ vendorPublication: null }, { vendorPublication: { status: "active", vendor: { status: "approved" } } }] }, select: { id: true } });
  if (!product) throw new ApiError(404, "Product is unavailable.");
  await prisma.savedProduct.createMany({ data: [{ customerId: c.id, productId }], skipDuplicates: true }); return { ok: true, saved: true };
}); }