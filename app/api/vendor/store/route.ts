import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { isReservedOrInvalidSlug } from "@/lib/store-slug";
export const dynamic = "force-dynamic";
const image = z.string().max(2048).refine(v => !v || /^https:\/\//.test(v) || v.startsWith("/uploads/") && !v.includes(".."));
const input = z.object({
  shopName: z.string().trim().min(1).max(160),
  storeSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80).refine(v => !isReservedOrInvalidSlug(v), "This store URL is reserved. Please choose another."),
  shopDescription: z.string().max(5000),
  shopLogo: image,
  storeBanner: image,
  storePolicies: z.string().max(5000),
  primaryCategory: z.string().trim().min(1).max(100),
  serviceCities: z.array(z.string().trim().min(1).max(100)).max(100),
});
export async function GET() { return api(async () => { const s = await getVendorFromSession(); if (!s) throw new ApiError(401, "Vendor sign-in required."); return { store: await prisma.vendor.findUnique({ where: { id: s.vendor.id }, select: { id: true, shopName: true, storeSlug: true, shopDescription: true, shopLogo: true, storeBanner: true, storePolicies: true, primaryCategory: true, serviceCities: true } }) }; }); }
export async function PATCH(request: Request) { return api(async () => {
  sameOrigin(request); const s = await getVendorFromSession(); if (!s || s.vendor.status !== "approved") throw new ApiError(403, "Approved vendor required."); const data = input.parse(await request.json());
  return prisma.$transaction(async tx => {
    const current = await tx.vendor.findUnique({ where: { id: s.vendor.id }, select: { storeSlug: true } });
    const alias = await tx.storeSlugAlias.findUnique({ where: { slug: data.storeSlug } });
    const conflict = await tx.vendor.findFirst({ where: { OR: [{ id: data.storeSlug }, { storeSlug: data.storeSlug }], NOT: { id: s.vendor.id } }, select: { id: true } });
    if (conflict || alias && alias.vendorId !== s.vendor.id) throw new ApiError(409, "This store URL is reserved.");
    if (current?.storeSlug && current.storeSlug !== data.storeSlug) await tx.storeSlugAlias.upsert({ where: { slug: current.storeSlug }, create: { slug: current.storeSlug, vendorId: s.vendor.id }, update: {} });
    await tx.vendor.update({ where: { id: s.vendor.id }, data, select: { id: true } });
    await tx.marketplaceAudit.create({ data: { actor: `vendor:${s.vendor.id}`, action: "STORE_UPDATED", target: s.vendor.id, reason: "Vendor edited public store profile." } }); return { success: true };
  }, { isolationLevel: "Serializable" });
}); }