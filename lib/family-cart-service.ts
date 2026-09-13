import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
export async function roomMember(tx: Prisma.TransactionClient, roomId: string, customerId: string) {
  const member = await tx.roomMember.findUnique({ where: { roomId_customerId: { roomId, customerId } }, include: { room: { select: { archived: true } } } });
  if (!member?.active) throw new ApiError(404, "Shopping room not found.");
  return member;
}
export async function canonicalCartLine(tx: Prisma.TransactionClient, productId: string, quantity: number, variant: string) {
  const p = await tx.product.findFirst({ where: { id: productId, isActive: true, stock: { gte: quantity } }, select: { id: true, name: true, price: true, stock: true, variants: true, vendorPublication: { select: { stock: true, status: true, vendor: { select: { status: true } } } } } });
  if (!p || (p.vendorPublication && (p.vendorPublication.status !== "active" || p.vendorPublication.vendor.status !== "approved" || p.vendorPublication.stock < quantity))) throw new ApiError(409, "Product is currently unavailable.");
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if ((variants.length && !variants.includes(variant)) || (!variants.length && variant)) throw new ApiError(400, "Please choose a valid product variant.");
  return { productId: p.id, name: p.name, price: Number(p.price), maxStock: Math.min(p.stock, p.vendorPublication?.stock ?? p.stock), image: "", quantity, variant: variant || undefined };
}