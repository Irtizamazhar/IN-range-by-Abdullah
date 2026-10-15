export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { shouldShowCustomerWelcome } from "@/lib/customer-welcome-policy";

export async function GET() {
  return api(async () => {
    const customer = await customerActor();
    const state = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { welcomeEligibleAt: true, welcomeSeenAt: true },
    });
    return { showWelcome: shouldShowCustomerWelcome(state?.welcomeEligibleAt ?? null, state?.welcomeSeenAt ?? null) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    await prisma.customer.updateMany({
      where: { id: customer.id, isActive: true, welcomeEligibleAt: { not: null }, welcomeSeenAt: null },
      data: { welcomeSeenAt: new Date() },
    });
    return { ok: true };
  });
}
