import { prisma } from "@/lib/prisma";
import { cancelParentOrder } from "@/lib/order-cancellation-service";

/** Auto-cancel bank-transfer orders older than 24h without proof. */
export async function autoCancelStaleBankOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: {
      paymentMethod: "bank_transfer",
      paymentStatus: "pending",
      orderStatus: { in: ["pending", "confirmed", "processing", "packed"] },
      createdAt: { lt: cutoff },
      AND: [
        { OR: [{ paymentScreenshot: null }, { paymentScreenshot: "" }] },
        { paymentProofData: null },
      ],
    },
    select: { id: true },
  });

  for (const order of stale) {
    const result = await cancelParentOrder({
      orderId: order.id,
      reason: "Payment proof was not received within 24 hours",
      actorType: "system",
      actorId: "auto-cancel",
    });
    if (!result.ok) {
      console.error("Auto-cancel failed", { orderId: order.id, error: result.error });
    }
  }
}
