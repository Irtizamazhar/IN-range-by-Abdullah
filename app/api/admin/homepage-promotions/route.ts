import { api } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { featureWrite } from "@/lib/public-feature-security";
import { homepagePromotionInput, verifyPromotionDestination } from "@/lib/homepage-promotions";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => { const auth = await requireAdminPermission("homepage.manage"); if ("response" in auth) return auth.response; return { promotions: await prisma.homepagePromotion.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], take: 200 }) }; }); }
export async function POST(request: Request) { return api(async () => { const auth = await requireAdminPermission("homepage.manage"); if ("response" in auth) return auth.response; featureWrite(request); const { id, ...input } = homepagePromotionInput.parse(await request.json()); await verifyPromotionDestination(input.href); const data = { ...input, startAt: input.startAt ? new Date(input.startAt) : null, endAt: input.endAt ? new Date(input.endAt) : null }; return prisma.$transaction(async tx => { const row = id ? await tx.homepagePromotion.update({ where: { id }, data }) : await tx.homepagePromotion.create({ data: { ...data, createdBy: auth.admin.id } }); await writeAdminAudit(tx, { adminId: auth.admin.id, action: id ? "HOMEPAGE_PROMOTION_UPDATED" : "HOMEPAGE_PROMOTION_CREATED", entityType: "HomepagePromotion", entityId: row.id }); return { promotion: row }; }); }); }
