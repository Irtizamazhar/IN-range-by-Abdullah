import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { writeAdminAudit } from "@/lib/admin-rbac";
import { removePrivateOwnerFolder } from "@/lib/private-storage";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Business records that must outlive a seller account. Most of them cascade-delete with the
 * vendor row, so deleting a seller that has any of them would silently erase customer orders,
 * payouts or offers. Such sellers can only be suspended.
 */
export async function vendorDeletionBlockers(vendorId: string, db: Db = prisma): Promise<string[]> {
  const where = { vendorId };
  const checks: Array<[string, Promise<number>]> = [
    ["orders", db.vendorShopOrder.count({ where })],
    ["order lines", db.vendorOrder.count({ where })],
    ["service bookings", db.orderService.count({ where })],
    ["earnings", db.vendorEarning.count({ where })],
    ["withdrawals", db.vendorWithdrawal.count({ where })],
    ["ledger entries", db.vendorLedgerEntry.count({ where })],
    ["pickup requests", db.pickupRequest.count({ where })],
    ["returns", db.returnRequest.count({ where })],
    ["disputes", db.dispute.count({ where })],
    ["refunds", db.refund.count({ where })],
    ["warranties", db.warrantyRecord.count({ where })],
    ["offers on customer Wants", db.wantOffer.count({ where })],
  ];
  const counts = await Promise.all(checks.map(([, count]) => count));
  return checks.flatMap(([label], index) => (counts[index] > 0 ? [`${counts[index]} ${label}`] : []));
}

export function blockedDeletionMessage(blockers: string[]): string {
  return `This seller has business history (${blockers.join(", ")}). Deleting it would erase customer orders and payment records, so suspend the account instead.`;
}

/**
 * Permanently deletes a seller with no business history: the account, its listings and services,
 * and its private identity documents. `confirmEmail` must repeat the seller's email.
 */
export async function deleteVendorAccount(params: {
  vendorId: string;
  confirmEmail: string;
  adminId: string;
  adminEmail?: string | null;
}): Promise<void> {
  const { vendorId, adminId, adminEmail } = params;
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, email: true, shopName: true, ownerName: true, status: true },
  });
  if (!vendor) throw new ApiError(404, "Vendor not found");
  if (params.confirmEmail.trim().toLowerCase() !== vendor.email.toLowerCase()) {
    throw new ApiError(400, "Type the seller's email exactly to confirm the deletion.");
  }

  let supportTicketIds: string[] = [];
  try {
    await prisma.$transaction(
      async (tx) => {
        // Re-checked inside the serializable transaction so a new order cannot slip in.
        const blockers = await vendorDeletionBlockers(vendorId, tx);
        if (blockers.length) throw new ApiError(409, blockedDeletionMessage(blockers));

        const products = await tx.vendorProduct.findMany({ where: { vendorId }, select: { publishedProductId: true } });
        const productIds = products.flatMap((p) => (p.publishedProductId ? [p.publishedProductId] : []));
        const serviceIds = (await tx.serviceOffering.findMany({ where: { vendorId }, select: { id: true } })).map((s) => s.id);
        supportTicketIds = (await tx.supportTicket.findMany({ where: { vendorId }, select: { id: true } })).map((t) => t.id);

        // Rows that block deletion (onDelete: Restrict) go first.
        if (productIds.length) await tx.roomItem.deleteMany({ where: { productId: { in: productIds } } });
        if (productIds.length || serviceIds.length) {
          await tx.productServiceAddon.deleteMany({
            where: { OR: [{ productId: { in: productIds } }, { serviceId: { in: serviceIds } }] },
          });
        }
        await tx.serviceOffering.deleteMany({ where: { vendorId } });
        await tx.vendorPromotion.deleteMany({ where: { vendorId } });
        await tx.storeSlugAlias.deleteMany({ where: { vendorId } });
        // Storefront copies of the seller's listings; otherwise they stay live without a seller.
        if (productIds.length) await tx.product.deleteMany({ where: { id: { in: productIds } } });
        // Cascades documents, listings, coupons, sessions (signs the seller out), notifications, etc.
        await tx.vendor.delete({ where: { id: vendorId } });

        await writeAdminAudit(tx, {
          adminId,
          action: "vendor_delete",
          entityType: "Vendor",
          entityId: vendorId,
          details: {
            adminEmail: adminEmail ?? null,
            shopName: vendor.shopName,
            ownerName: vendor.ownerName,
            email: vendor.email,
            previousStatus: vendor.status,
            deletedListings: products.length,
            deletedServices: serviceIds.length,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ApiError(409, "This seller is still linked to other records (for example a customer offer). Suspend the account instead.");
    }
    throw error;
  }

  // Files are removed only after the database delete committed. A failure here leaves
  // orphaned files but never a half-deleted account.
  const folders: Array<["vendor-docs" | "vendor-appeals" | "support", string]> = [
    ["vendor-docs", vendorId],
    ["vendor-appeals", vendorId],
    ...supportTicketIds.map((id) => ["support", id] as ["support", string]),
  ];
  for (const [namespace, owner] of folders) {
    try {
      await removePrivateOwnerFolder(namespace, owner);
    } catch (error) {
      console.error("vendor delete: private file cleanup failed", namespace, error instanceof Error ? error.name : "Unknown");
    }
  }
}
