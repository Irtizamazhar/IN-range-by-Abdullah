import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";

export type VendorNotificationType =
  | "order_new"
  | "order_cancelled"
  | "delivered_payout"
  | "withdrawal_approved"
  | "withdrawal_paid"
  | "withdrawal_rejected";

export async function createVendorNotification(params: {
  vendorId: string;
  title: string;
  message: string;
  type: VendorNotificationType;
}) {
  const title = sanitizePlainText(params.title, 200);
  const message = sanitizePlainText(params.message, 4000);
  return prisma.vendorNotification.create({
    data: {
      vendorId: params.vendorId,
      title,
      message,
      type: params.type,
    },
  });
}
