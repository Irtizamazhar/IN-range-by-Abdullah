import type { Prisma } from "@prisma/client";
import { wantImages } from "@/lib/want-images";
import { removeWantPhotoFile } from "@/lib/want-photo-file";

/** A Want whose quote became an order stays: orders read the quote for seller attribution. */
const NOT_ORDERED: Prisma.WantWhereInput = { OR: [{ quote: { is: null } }, { quote: { is: { orderId: null } } }] };

/**
 * Permanently deletes the matching Wants with their offers, offer revisions and unordered quotes.
 * Interests, reactions and reports cascade in the database. Returns deleted ids, ordered Wants skipped and photos to remove.
 */
export async function deleteWants(tx: Prisma.TransactionClient, where: Prisma.WantWhereInput) {
  const [rows, skipped] = await Promise.all([
    tx.want.findMany({ where: { AND: [where, NOT_ORDERED] }, select: { id: true, photo: true, photos: true } }),
    tx.want.count({ where: { AND: [where, { NOT: NOT_ORDERED }] } }),
  ]);
  const ids = rows.map((row) => row.id);
  if (ids.length) {
    await tx.offerQuote.deleteMany({ where: { wantId: { in: ids } } });
    await tx.offerRevision.deleteMany({ where: { offer: { wantId: { in: ids } } } });
    await tx.wantOffer.deleteMany({ where: { wantId: { in: ids } } });
    await tx.want.deleteMany({ where: { id: { in: ids } } });
  }
  return { ids, skipped, photos: rows.flatMap((row) => wantImages(row)) };
}

/** Best-effort cleanup of uploaded photos once the delete transaction has committed. */
export async function removeWantPhotos(photos: string[]) {
  for (const photo of photos) await removeWantPhotoFile(photo);
}
