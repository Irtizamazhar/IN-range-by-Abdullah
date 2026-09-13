import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { offerTerms, validateOfferExpiry, validateOfferProduct } from "@/lib/offer-service";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const session = await getVendorFromSession(); if (!session) throw new ApiError(401, "Sign in as a vendor.");
  return { offers: await prisma.wantOffer.findMany({ where: { vendorId: session.vendor.id }, include: { revisions: { orderBy: { revisionNumber: "desc" } }, want: { select: { id: true, title: true, city: true, status: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }) };
}); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const session = await getVendorFromSession(); if (!session || session.vendor.status !== "approved") throw new ApiError(403, "Only approved vendors can submit offers.");
  const body = await request.json(); const terms = offerTerms.parse(body); const wantId = String(body.wantId || ""); validateOfferExpiry(new Date(terms.expiresAt));
  return prisma.$transaction(async tx => {
    const want = await tx.want.findFirst({ where: { id: wantId, status: "OPEN", expiresAt: { gt: new Date() } }, select: { id: true } }); if (!want) throw new ApiError(409, "Want is not open.");
    if (terms.productId) await validateOfferProduct(tx, session.vendor.id, terms.productId, terms.quantity);
    const offer = await tx.wantOffer.create({ data: { wantId, vendorId: session.vendor.id, revisions: { create: { ...terms, expiresAt: new Date(terms.expiresAt), revisionNumber: 1, initiator: "VENDOR" } } } });
    return { offer };
  }, { isolationLevel: "Serializable" });
}); }