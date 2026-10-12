import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { wantInput } from "@/lib/want-schema";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { removeWantPhotoFile } from "@/lib/want-photo-file";
import { wantImages } from "@/lib/want-images";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(_request: Request, { params }: Context) { return api(async () => {
  const want = await prisma.want.findUnique({ where: { id: params.id }, select: { id: true, customerId: true, title: true, requestType: true, occasion: true, category: true, city: true, budgetMin: true, budgetMax: true, budgetFlexible: true, quantity: true, description: true, condition: true, photo: true, needBy: true, status: true, expiresAt: true, createdAt: true, _count: { select: { interests: true, offers: true } } } });
  if (!want) throw new ApiError(404, "Want not found.");
  let isOwner = false;
  try { const customer = await customerActor(); isOwner = customer.id === want.customerId; } catch { /* anonymous viewer */ }
  if ((want.status !== "OPEN" || want.expiresAt <= new Date()) && !isOwner) throw new ApiError(404, "Want unavailable.");
  const offers = isOwner
    ? await prisma.wantOffer.findMany({ where: { wantId: want.id }, orderBy: { updatedAt: "desc" }, include: { vendor: { select: { id: true, shopName: true, city: true, storeSlug: true } }, revisions: { orderBy: { revisionNumber: "desc" } } } })
    : [];
  const { customerId, ...publicWant } = want; void customerId;
  return { want: { ...publicWant, images: wantImages(want), isOwner, offers } };
}); }
export async function PATCH(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const customer = await customerActor(); const body = await request.json();
  const result = await prisma.$transaction(async tx => {
    const want = await tx.want.findUnique({ where: { id: params.id }, include: { _count: { select: { offers: true } } } });
    if (!want) throw new ApiError(404, "Want not found.");
    if (want.customerId !== customer.id) throw new ApiError(403, "You can only edit your own Wants.");
    if (["FULFILLED", "EXPIRED", "CLOSED"].includes(want.status)) throw new ApiError(409, "This Want is no longer editable.");
    if (body.action === "close") {
      const closed = await tx.want.update({ where: { id: want.id }, data: { status: "CLOSED" } });
      await tx.wantOffer.updateMany({ where: { wantId: want.id, status: "SUBMITTED" }, data: { status: "REJECTED" } });
      return { want: closed, replacedPhoto: null };
    }
    const { draft, title, description, category, city, condition, needBy, ...data } = wantInput.parse(body);
    if (want._count.offers > 0 && (data.requestType !== want.requestType || sanitizePlainText(category, 100) !== want.category)) throw new ApiError(409, "Sellers have already made offers on this Want, so its request type and category can't be changed.");
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : want.expiresAt;
    if (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 90 * 86400000) throw new ApiError(400, "Invalid expiry.");
    const updated = await tx.want.update({ where: { id: want.id }, data: { ...data, title: sanitizePlainText(title, 160), description: description ? sanitizePlainText(description, 5000) : null, category: sanitizePlainText(category, 100), city: sanitizePlainText(city, 100), condition: condition ? sanitizePlainText(condition, 60) : undefined, needBy: needBy ? new Date(needBy) : null, expiresAt, status: draft ? "DRAFT" : "PENDING_MODERATION", moderationReason: null } });
    return { want: updated, replacedPhoto: data.photo !== undefined && want.photo !== updated.photo ? want.photo : null };
  }, { isolationLevel: "Serializable" });
  await removeWantPhotoFile(result.replacedPhoto);
  return { want: result.want };
}); }
/** Owners delete Wants nobody has made offers on; Wants with seller offers are closed instead so vendor history stays intact. */
export async function DELETE(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const customer = await customerActor();
  const result = await prisma.$transaction(async tx => {
    const want = await tx.want.findUnique({ where: { id: params.id }, select: { id: true, customerId: true, status: true, photo: true, quote: { select: { id: true } }, _count: { select: { offers: true } } } });
    if (!want) throw new ApiError(404, "Want not found.");
    if (want.customerId !== customer.id) throw new ApiError(403, "You can only delete your own Wants.");
    if (want.quote || want.status === "FULFILLED") throw new ApiError(409, "This Want already has an order, so it can't be deleted.");
    if (want._count.offers > 0) {
      if (want.status !== "CLOSED") {
        await tx.want.update({ where: { id: want.id }, data: { status: "CLOSED" } });
        await tx.wantOffer.updateMany({ where: { wantId: want.id, status: { in: ["SUBMITTED", "COUNTERED"] } }, data: { status: "REJECTED" } });
      }
      return { deleted: false, closed: true, photo: null };
    }
    await tx.want.delete({ where: { id: want.id } });
    return { deleted: true, closed: false, photo: want.photo };
  }, { isolationLevel: "Serializable" });
  await removeWantPhotoFile(result.photo);
  return { deleted: result.deleted, closed: result.closed };
}); }
