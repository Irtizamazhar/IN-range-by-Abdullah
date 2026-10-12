import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { DEFAULT_OFFER_DAYS, newOfferInput, pickOfferProduct, sanitizeOfferTerms, validateOfferExpiry, validateOfferProduct } from "@/lib/offer-service";
import { notifyCustomer } from "@/lib/marketplace-notifications";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const session = await getVendorFromSession(); if (!session) throw new ApiError(401, "Sign in as a vendor.");
  return { offers: await prisma.wantOffer.findMany({ where: { vendorId: session.vendor.id }, include: { revisions: { orderBy: { revisionNumber: "desc" } }, want: { select: { id: true, title: true, city: true, status: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }) };
}); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const session = await getVendorFromSession(); if (!session || session.vendor.status !== "approved") throw new ApiError(403, "Only approved vendors can submit offers.");
  // Only unitPrice, warranty, expiresAt and message (plus wantId, and productId when no product matched) are read from the client.
  const parsed = newOfferInput.safeParse(await request.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message || "Please check the offer details.");
  const input = parsed.data; const wantId = input.wantId;
  if (input.expiresAt) validateOfferExpiry(new Date(input.expiresAt));
  try {
    return await prisma.$transaction(async tx => {
      const want = await tx.want.findFirst({ where: { id: wantId, status: "OPEN", expiresAt: { gt: new Date() } }, select: { id: true, title: true, category: true, customerId: true, quantity: true, condition: true, expiresAt: true } }); if (!want) throw new ApiError(409, "This Want is no longer open for offers.");
      const existing = await tx.wantOffer.findUnique({ where: { wantId_vendorId: { wantId, vendorId: session.vendor.id } }, select: { id: true } });
      if (existing) throw new ApiError(409, "You already have an offer thread on this Want. Manage it from My Offers instead of submitting a new one.");
      // Server-owned terms: the customer's quantity and condition, no delivery charge or estimate, and the catalog product.
      const product = await pickOfferProduct(tx, session.vendor.id, want, input.unitPrice, input.productId);
      const defaultExpiry = new Date(Math.min(Date.now() + DEFAULT_OFFER_DAYS * 86400000, want.expiresAt.getTime()));
      const terms = sanitizeOfferTerms({
        productId: product.id, price: input.unitPrice, quantity: want.quantity, shipping: 0, delivery: "",
        condition: want.condition || "Any", warranty: input.warranty, message: input.message,
        expiresAt: (input.expiresAt ? new Date(input.expiresAt) : defaultExpiry).toISOString(),
      });
      await validateOfferProduct(tx, session.vendor.id, terms.productId, terms.quantity);
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