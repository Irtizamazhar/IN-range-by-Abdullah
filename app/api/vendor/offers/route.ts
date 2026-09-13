import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { offerTerms, sanitizeOfferTerms, validateOfferExpiry, validateOfferProduct } from "@/lib/offer-service";
import { notifyCustomer } from "@/lib/marketplace-notifications";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const session = await getVendorFromSession(); if (!session) throw new ApiError(401, "Sign in as a vendor.");
  return { offers: await prisma.wantOffer.findMany({ where: { vendorId: session.vendor.id }, include: { revisions: { orderBy: { revisionNumber: "desc" } }, want: { select: { id: true, title: true, city: true, status: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }) };
}); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const session = await getVendorFromSession(); if (!session || session.vendor.status !== "approved") throw new ApiError(403, "Only approved vendors can submit offers.");
  const body = await request.json(); const terms = sanitizeOfferTerms(offerTerms.parse(body)); const wantId = String(body.wantId || ""); validateOfferExpiry(new Date(terms.expiresAt));
  try {
    return await prisma.$transaction(async tx => {
      const want = await tx.want.findFirst({ where: { id: wantId, status: "OPEN", expiresAt: { gt: new Date() } }, select: { id: true, title: true, customerId: true } }); if (!want) throw new ApiError(409, "Want is not open.");
      const existing = await tx.wantOffer.findUnique({ where: { wantId_vendorId: { wantId, vendorId: session.vendor.id } }, select: { id: true } });
      if (existing) throw new ApiError(409, "You already have an offer thread on this Want. Manage it from My Offers instead of submitting a new one.");
      if (terms.productId) await validateOfferProduct(tx, session.vendor.id, terms.productId, terms.quantity);
      const offer = await tx.wantOffer.create({ data: { wantId, vendorId: session.vendor.id, revisions: { create: { ...terms, expiresAt: new Date(terms.expiresAt), revisionNumber: 1, initiator: "VENDOR" } } } });
      await notifyCustomer(tx, want.customerId, `offer-submitted:${offer.id}`, "New offer on your Want", `/wants/${wantId}`, `A seller sent an offer for "${want.title}".`);
      return { offer };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "You already have an offer thread on this Want. Manage it from My Offers instead of submitting a new one.");
    }
    throw error;
  }
}); }