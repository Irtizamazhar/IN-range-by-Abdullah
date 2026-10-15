export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { api, ApiError } from "@/lib/marketplace-api";
import { customerRegistrationSameOrigin } from "@/lib/customer-registration-origin";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { consumeOrReject, createRegisterRateLimiter } from "@/lib/security/rate-limit";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { campaignEmail } from "@/lib/joro-email-templates";

const limiter = createRegisterRateLimiter();

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminPermission("marketing.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    customerRegistrationSameOrigin(request);
    const limited = await consumeOrReject(limiter, `email-campaign-test:${auth.admin.id}`);
    if (!limited.ok) throw new ApiError(429, "Too many test emails. Try again later.");
    if (!isMailConfigured()) throw new ApiError(503, "Transactional email is not configured.");
    const campaign = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
    if (!campaign) throw new ApiError(404, "Campaign not found.");
    const recipient = auth.admin.email?.trim();
    if (!recipient) throw new ApiError(400, "Admin email is unavailable.");
    const gate = await prisma.emailCampaign.updateMany({
      where: { id: campaign.id, OR: [{ lastTestStatus: null }, { lastTestStatus: { not: "PENDING" } }, { lastTestAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }] },
      data: { lastTestAt: new Date(), lastTestStatus: "PENDING" },
    });
    if (gate.count !== 1) throw new ApiError(409, "A test email is already in progress.");
    const accepted = await sendMail({ to: recipient, ...campaignEmail(`[TEST] ${campaign.subject}`, campaign.previewText, campaign.bodyHtml) });
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { lastTestAt: new Date(), lastTestStatus: accepted ? "SENT" : "FAILED" } });
    await writeAdminAudit(prisma, { adminId: auth.admin.id, action: accepted ? "EMAIL_CAMPAIGN_TEST_SENT" : "EMAIL_CAMPAIGN_TEST_FAILED", entityType: "EmailCampaign", entityId: campaign.id });
    if (!accepted) throw new ApiError(502, "Test email was not accepted by the mail provider.");
    return { ok: true, status: "SENT" };
  });
}
