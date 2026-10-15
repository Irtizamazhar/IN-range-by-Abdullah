export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError } from "@/lib/marketplace-api";
import { customerRegistrationSameOrigin } from "@/lib/customer-registration-origin";
import { verifyMarketingUnsubscribeToken } from "@/lib/marketing-unsubscribe";

export async function POST(request: Request) {
  return api(async () => {
    customerRegistrationSameOrigin(request);
    const { token } = z.object({ token: z.string().min(70).max(160) }).parse(await request.json());
    const recipient = verifyMarketingUnsubscribeToken(token);
    if (!recipient) throw new ApiError(400, "This unsubscribe link is invalid.");
    const data = { marketingEmailConsentAt: null, marketingEmailUnsubscribedAt: new Date() };
    if (recipient.type === "customer") await prisma.customer.updateMany({ where: { id: recipient.id }, data });
    else await prisma.vendor.updateMany({ where: { id: recipient.id }, data });
    return { ok: true };
  });
}
