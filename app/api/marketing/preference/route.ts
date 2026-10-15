export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError } from "@/lib/marketplace-api";
import { customerRegistrationSameOrigin } from "@/lib/customer-registration-origin";
import { getCustomerSession } from "@/lib/sessions";
import { getVendorFromSession } from "@/lib/vendor-auth-server";

async function actor(): Promise<{ type: "customer" | "vendor"; id: string }> {
  const customer = await getCustomerSession();
  if (customer?.user?.role === "customer" && customer.user.id) {
    const exists = await prisma.customer.findUnique({ where: { id: customer.user.id, isActive: true }, select: { id: true } });
    if (exists) return { type: "customer", id: exists.id };
  }
  const vendor = await getVendorFromSession({ allowUnapproved: true });
  if (vendor?.vendor?.id) return { type: "vendor", id: vendor.vendor.id };
  throw new ApiError(401, "Please sign in to update email preferences.");
}

export async function GET() {
  return api(async () => {
    const account = await actor();
    const state = account.type === "customer"
      ? await prisma.customer.findUnique({ where: { id: account.id }, select: { marketingEmailConsentAt: true, marketingEmailUnsubscribedAt: true } })
      : await prisma.vendor.findUnique({ where: { id: account.id }, select: { marketingEmailConsentAt: true, marketingEmailUnsubscribedAt: true } });
    return { type: account.type, subscribed: Boolean(state?.marketingEmailConsentAt && !state.marketingEmailUnsubscribedAt) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    if (!request.headers.get("origin")) throw new ApiError(403, "Please reload the JORO website and try again.");
    customerRegistrationSameOrigin(request);
    const account = await actor();
    const { subscribed } = z.object({ subscribed: z.boolean() }).parse(await request.json());
    const data = subscribed
      ? { marketingEmailConsentAt: new Date(), marketingEmailUnsubscribedAt: null }
      : { marketingEmailConsentAt: null, marketingEmailUnsubscribedAt: new Date() };
    if (account.type === "customer") await prisma.customer.updateMany({ where: { id: account.id, isActive: true }, data });
    else await prisma.vendor.updateMany({ where: { id: account.id }, data });
    return { ok: true, subscribed };
  });
}
