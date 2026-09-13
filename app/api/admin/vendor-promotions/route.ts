import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, adminActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
const media = z.string().max(2048).refine(v => !v || (v.startsWith("/uploads/") && !v.includes("..")) || /^https:\/\//.test(v));
const promotionInput = z.object({ id: z.string().optional(), vendorId: z.string(), title: z.string().trim().min(1).max(160), subtitle: z.string().trim().max(300), desktopImage: media, mobileImage: media, ctaText: z.string().trim().min(1).max(60), priority: z.number().int().min(0).max(1000), startAt: z.string().datetime(), endAt: z.string().datetime(), status: z.enum(["DRAFT", "ACTIVE", "DISABLED", "ARCHIVED"]), isSponsored: z.boolean(), reason: z.string().trim().min(3).max(2000) }).refine(v => new Date(v.endAt) > new Date(v.startAt));
export async function GET() { return api(async () => { await adminActor(); return { campaigns: await prisma.vendorPromotion.findMany({ include: { vendor: { select: { shopName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }), vendors: await prisma.vendor.findMany({ where: { status: "approved" }, select: { id: true, shopName: true }, take: 500 }) }; }); }
async function save(request: Request) { return api(async () => {
  sameOrigin(request); const actor = await adminActor(); const { id, reason, ...input } = promotionInput.parse(await request.json());
  return prisma.$transaction(async tx => {
    if (!await tx.vendor.findFirst({ where: { id: input.vendorId, status: "approved" }, select: { id: true } })) throw new ApiError(400, "Choose an approved public vendor.");
    const data = { ...input, startAt: new Date(input.startAt), endAt: new Date(input.endAt) };
    const campaign = id ? await tx.vendorPromotion.update({ where: { id }, data }) : await tx.vendorPromotion.create({ data: { ...data, createdBy: actor } });
    await tx.marketplaceAudit.create({ data: { actor, target: campaign.id, action: id ? "PROMOTION_UPDATED" : "PROMOTION_CREATED", reason } });
    return { campaign };
  });
}); }
export const POST = save;
export const PATCH = save;