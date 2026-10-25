import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { wantInput } from "@/lib/want-schema";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { removeWantPhotoFile, wantPhotoList } from "@/lib/want-photo-file";
import { wantImages } from "@/lib/want-images";
import { resolveWantViewer, wantEngagement } from "@/lib/want-engagement";
import { publicDisplayName } from "@/lib/want-social";
import { assertWantPhotoStored } from "@/lib/want-photo-file";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(_request: Request, { params }: Context) { return api(async () => {
  const want = await prisma.want.findUnique({ where: { id: params.id }, select: { id: true, customerId: true, title: true, requestType: true, occasion: true, category: true, city: true, budgetMin: true, budgetMax: true, budgetFlexible: true, quantity: true, description: true, condition: true, photo: true, photos: true, needBy: true, status: true, expiresAt: true, createdAt: true, customer: { select: { name: true, image: true, isActive: true } }, _count: { select: { interests: true, offers: true } } } });
  if (!want) throw new ApiError(404, "Want not found.");
  const viewer = await resolveWantViewer();
  const isOwner = viewer.customerId === want.customerId;
  // Hidden, rejected, pending, expired or deactivated-owner Wants exist only for their owner.
  if (!isOwner && (want.status !== "OPEN" || want.expiresAt <= new Date() || !want.customer.isActive)) throw new ApiError(404, "Want unavailable.");
  const [offers, engagement] = await Promise.all([
    isOwner
      ? prisma.wantOffer.findMany({ where: { wantId: want.id }, orderBy: { updatedAt: "desc" }, include: { vendor: { select: { id: true, shopName: true, city: true, storeSlug: true } }, revisions: { orderBy: { revisionNumber: "desc" } } } })
      : Promise.resolve([]),
    wantEngagement([want], viewer),
  ]);
  const { customerId, customer, ...publicWant } = want; void customerId;
  const social = engagement.get(want.id)!;
  return { want: {
    ...publicWant,
    // `interests` keeps the active-account joined count for older clients reading _count.
    _count: { interests: social.joinedCount, offers: social.offerVendorCount },
    customer: { name: publicDisplayName(customer.name), image: customer.image },
    images: wantImages(want), isOwner, offers,
    joinedCount: social.joinedCount, offerVendorCount: social.offerVendorCount, reactions: social.reactions, viewer: social.viewer,
  } };
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
      return { want: closed, removedPhotos: [] as string[] };
    }
    const input = wantInput.parse(body);
    const { draft, title, description, category, city, condition, needBy, photo: _photo, photos: _photos, ...data } = input; void _photo; void _photos;
    if (want._count.offers > 0 && (data.requestType !== want.requestType || sanitizePlainText(category, 100) !== want.category)) throw new ApiError(409, "Sellers have already made offers on this Want, so its request type and category can't be changed.");
    // A body with neither field keeps the current photos.
    const previous = wantImages(want);
    const photos = input.photos !== undefined || input.photo !== undefined ? wantPhotoList(input) : previous;
    for (const photo of photos) if (!previous.includes(photo)) await assertWantPhotoStored(photo);
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : want.expiresAt;
    if (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 90 * 86400000) throw new ApiError(400, "Invalid expiry.");
    const updated = await tx.want.update({ where: { id: want.id }, data: { ...data, photo: photos[0] ?? null, photos, title: sanitizePlainText(title, 160), description: description ? sanitizePlainText(description, 5000) : null, category: sanitizePlainText(category, 100), city: sanitizePlainText(city, 100), condition: condition ? sanitizePlainText(condition, 60) : undefined, needBy: needBy ? new Date(needBy) : null, expiresAt, status: draft ? "DRAFT" : "PENDING_MODERATION", moderationReason: null } });
    return { want: updated, removedPhotos: previous.filter(photo => !photos.includes(photo)) };
  }, { isolationLevel: "Serializable" });
  for (const photo of result.removedPhotos) await removeWantPhotoFile(photo);
  return { want: result.want };
}); }
/** Owners delete Wants nobody has made offers on; Wants with seller offers are closed instead so vendor history stays intact. */
export async function DELETE(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const customer = await customerActor();
  const result = await prisma.$transaction(async tx => {
    const want = await tx.want.findUnique({ where: { id: params.id }, select: { id: true, customerId: true, status: true, photo: true, photos: true, quote: { select: { id: true } }, _count: { select: { offers: true } } } });
    if (!want) throw new ApiError(404, "Want not found.");
    if (want.customerId !== customer.id) throw new ApiError(403, "You can only delete your own Wants.");
    if (want.quote || want.status === "FULFILLED") throw new ApiError(409, "This Want already has an order, so it can't be deleted.");
    if (want._count.offers > 0) {
      if (want.status !== "CLOSED") {
        await tx.want.update({ where: { id: want.id }, data: { status: "CLOSED" } });
        await tx.wantOffer.updateMany({ where: { wantId: want.id, status: { in: ["SUBMITTED", "COUNTERED"] } }, data: { status: "REJECTED" } });
      }
      return { deleted: false, closed: true, photos: [] as string[] };
    }
    await tx.want.delete({ where: { id: want.id } });
    return { deleted: true, closed: false, photos: wantImages(want) };
  }, { isolationLevel: "Serializable" });
  for (const photo of result.photos) await removeWantPhotoFile(photo);
  return { deleted: result.deleted, closed: result.closed };
}); }
