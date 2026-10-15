export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { api, ApiError } from "@/lib/marketplace-api";
import { customerRegistrationSameOrigin } from "@/lib/customer-registration-origin";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { emailCampaignInput } from "@/lib/email-campaign-schema";

export async function GET() {
  const auth = await requireAdminPermission("marketing.manage");
  if ("response" in auth) return auth.response;
  return api(async () => ({
    campaigns: await prisma.emailCampaign.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
    eligibleCustomers: await prisma.customer.count({ where: { isActive: true, marketingEmailConsentAt: { not: null }, marketingEmailUnsubscribedAt: null } }),
    eligibleVendors: await prisma.vendor.count({ where: { status: "approved", isEmailVerified: true, marketingEmailConsentAt: { not: null }, marketingEmailUnsubscribedAt: null } }),
  }));
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("marketing.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    customerRegistrationSameOrigin(request);
    const input = emailCampaignInput.parse(await request.json());
    if (input.recipientIds.length) {
      const ids = Array.from(new Set(input.recipientIds));
      const [customers, vendors] = await Promise.all([
        prisma.customer.count({ where: { id: { in: ids } } }),
        prisma.vendor.count({ where: { id: { in: ids } } }),
      ]);
      if (customers + vendors !== ids.length) throw new ApiError(400, "One or more selected recipients no longer exist.");
    }
    if (input.id && !await prisma.emailCampaign.findUnique({ where: { id: input.id }, select: { id: true } })) throw new ApiError(404, "Campaign not found.");
    const data = { subject: input.subject, previewText: input.previewText, bodyHtml: input.bodyHtml, audience: input.audience, recipientIds: input.recipientIds };
    const adminEmail = auth.admin.email;
    if (!adminEmail) throw new ApiError(403, "Admin email is unavailable.");
    const campaign = await prisma.$transaction(async tx => {
      const saved = input.id
        ? await tx.emailCampaign.update({ where: { id: input.id }, data })
        : await tx.emailCampaign.create({ data: { ...data, createdBy: adminEmail } });
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: input.id ? "EMAIL_CAMPAIGN_DRAFT_UPDATED" : "EMAIL_CAMPAIGN_DRAFT_CREATED", entityType: "EmailCampaign", entityId: saved.id });
      return saved;
    });
    return { campaign };
  });
}
