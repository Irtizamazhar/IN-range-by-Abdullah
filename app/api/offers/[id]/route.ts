import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { offerTerms, sanitizeOfferTerms, validateOfferExpiry, validateOfferProduct } from "@/lib/offer-service";
import { notifyCustomer, notifyVendor } from "@/lib/marketplace-notifications";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function PATCH(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const body = await request.json(); const action = z.enum(["revise", "counter", "withdraw", "reject", "accept"]).parse(body.action);
  const vendor = ["revise", "withdraw"].includes(action) ? await getVendorFromSession() : null;
  const customer = vendor ? null : await customerActor();
  return prisma.$transaction(async tx => {
    const offer = await tx.wantOffer.findUnique({ where: { id: params.id }, include: { want: true, vendor: { select: { status: true, shopName: true } }, revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } } });
    if (!offer) throw new ApiError(404, "Offer not found.");
    if (vendor ? vendor.vendor.id !== offer.vendorId || vendor.vendor.status !== "approved" : customer?.id !== offer.want.customerId) throw new ApiError(403, "You cannot change this offer.");
    if (action === "accept") {
      const prior = await tx.offerQuote.findUnique({ where: { wantId: offer.wantId } });
      if (prior && prior.customerId === customer?.id && prior.revisionId === body.revisionId) return { quote: prior };
      if (prior) throw new ApiError(409, "This Want already has an accepted quote.");
    }
    const latest = offer.revisions[0];
    if (!latest || !["SUBMITTED", "COUNTERED"].includes(offer.status) || offer.want.status !== "OPEN" || offer.want.expiresAt <= new Date() || offer.vendor.status !== "approved" || latest.expiresAt <= new Date()) throw new ApiError(409, "Offer is no longer active.");
    if (body.revisionId !== latest.id) throw new ApiError(409, "Offer terms changed. Refresh before continuing.");
    const customerHref = `/account/offers#${offer.id}`;
    const vendorHref = `/vendor/dashboard/offers#${offer.id}`;
    if (action === "accept") {
      if (!customer || latest.initiator !== "VENDOR") throw new ApiError(409, "Wait for the vendor to respond to your counter.");
      const product = await validateOfferProduct(tx, offer.vendorId, latest.productId, latest.quantity);
      const key = z.string().uuid().parse(body.idempotencyKey);
      const quote = await tx.offerQuote.create({ data: { idempotencyKey: key, customerId: customer.id, wantId: offer.wantId, revisionId: latest.id, expiresAt: latest.expiresAt, snapshot: { productId: product.id, name: product.name, vendorId: offer.vendorId, price: latest.price.toString(), quantity: latest.quantity, shipping: latest.shipping.toString(), payable: latest.price.mul(latest.quantity).add(latest.shipping).toString(), city: offer.want.city, delivery: latest.delivery, condition: latest.condition, warranty: latest.warranty, currency: "PKR" } } });
      await tx.wantOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
      await notifyVendor(tx, offer.vendorId, `offer-accepted:${offer.id}`, "Offer accepted", vendorHref, `Your offer on "${offer.want.title}" was accepted. Await the customer's checkout.`);
      return { quote };
    }
    if (action === "withdraw" || action === "reject") {
      const updated = await tx.wantOffer.update({ where: { id: offer.id }, data: { status: action === "withdraw" ? "WITHDRAWN" : "REJECTED" } });
      if (action === "reject") await notifyVendor(tx, offer.vendorId, `offer-rejected:${offer.id}`, "Offer rejected", vendorHref, `The customer rejected your offer on "${offer.want.title}".`);
      else await notifyCustomer(tx, offer.want.customerId, `offer-withdrawn:${offer.id}`, "Seller withdrew their offer", customerHref, `${offer.vendor.shopName} withdrew their offer on "${offer.want.title}".`);
      return { offer: updated };
    }
    if (action === "counter" && latest.initiator !== "VENDOR") throw new ApiError(409, "Wait for a vendor response.");
    const terms = sanitizeOfferTerms(offerTerms.parse(body)); validateOfferExpiry(new Date(terms.expiresAt));
    if (!vendor && terms.productId !== latest.productId) throw new ApiError(400, "A counter cannot substitute the vendor product.");
    if (terms.productId) await validateOfferProduct(tx, offer.vendorId, terms.productId, terms.quantity);
    const version = offer.version + 1;
    await tx.offerRevision.create({ data: { ...terms, expiresAt: new Date(terms.expiresAt), offerId: offer.id, revisionNumber: version, initiator: vendor ? "VENDOR" : "CUSTOMER" } });
    const updated = await tx.wantOffer.update({ where: { id: offer.id }, data: { version, status: vendor ? "SUBMITTED" : "COUNTERED" } });
    if (vendor) await notifyCustomer(tx, offer.want.customerId, `offer-revised:${offer.id}:${version}`, "Seller updated their offer", customerHref, `${offer.vendor.shopName} sent new terms for "${offer.want.title}".`);
    else await notifyVendor(tx, offer.vendorId, `offer-countered:${offer.id}:${version}`, "Customer sent a counter offer", vendorHref, `A customer countered your offer on "${offer.want.title}".`);
    return { offer: updated };
  }, { isolationLevel: "Serializable" });
}); }
