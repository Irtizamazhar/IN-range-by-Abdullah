export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { customerActor } from "@/lib/marketplace-api";
import { safeAccountLink } from "@/lib/customer-account-policy";
import { shouldShowCustomerWelcome } from "@/lib/customer-welcome-policy";

/**
 * Landing step after "Continue with Google": a customer whose welcome is still pending goes to the home page
 * (where the welcome popup lives); everyone else continues to the page they started from.
 */
export async function GET(request: Request) {
  const next = safeAccountLink(new URL(request.url).searchParams.get("next")) || "/";
  let destination = next;
  try {
    const customer = await customerActor();
    const state = await prisma.customer.findUnique({ where: { id: customer.id }, select: { welcomeEligibleAt: true, welcomeSeenAt: true } });
    if (shouldShowCustomerWelcome(state?.welcomeEligibleAt ?? null, state?.welcomeSeenAt ?? null)) destination = "/";
  } catch {
    // Not signed in (or any lookup failure): fall back to the requested page.
  }
  return new Response(null, { status: 303, headers: { Location: destination, "Cache-Control": "no-store" } });
}
