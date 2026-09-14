import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
export const roomCommentText = z.string().max(10000).transform(value => sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim()).pipe(z.string().min(1).max(2000));
export const roomProductSelect = {
  id: true, name: true, price: true, stock: true, variants: true, isActive: true,
  listingImageUrls: true, productImages: { select: { id: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
  vendorPublication: { select: { stock: true, status: true, vendor: { select: { shopName: true, storeSlug: true, status: true } } } },
} satisfies Prisma.ProductSelect;
export function roomProductImage(p: { listingImageUrls: Prisma.JsonValue; productImages: { id: string }[] }) {
  const listed = Array.isArray(p.listingImageUrls) ? p.listingImageUrls.find((v): v is string => typeof v === "string" && /^(https?:\/\/|\/(?!\/))/.test(v)) : undefined;
  return listed || (p.productImages[0] ? `/api/image/${p.productImages[0].id}` : "");
}
export async function roomMember(tx: Prisma.TransactionClient, roomId: string, customerId: string) {
  const member = await tx.roomMember.findUnique({ where: { roomId_customerId: { roomId, customerId } }, include: { room: { select: { archived: true } } } });
  if (!member?.active) throw new ApiError(404, "Shopping room not found.");
  return member;
}
export async function canonicalCartLine(tx: Prisma.TransactionClient, productId: string, quantity: number, variant: string) {
  z.number().int().min(1).max(1000).parse(quantity);
  const p = await tx.product.findFirst({ where: { id: productId, isActive: true, stock: { gte: quantity } }, select: roomProductSelect });
  if (!p || (p.vendorPublication && (p.vendorPublication.status !== "active" || p.vendorPublication.vendor.status !== "approved" || p.vendorPublication.stock < quantity))) throw new ApiError(409, "Product is currently unavailable.");
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if ((variants.length && !variants.includes(variant)) || (!variants.length && variant)) throw new ApiError(400, "Please choose a valid product variant.");
  return { productId: p.id, name: p.name, price: Number(p.price), maxStock: Math.min(p.stock, p.vendorPublication?.stock ?? p.stock), image: roomProductImage(p), quantity, variant: variant || undefined };
}