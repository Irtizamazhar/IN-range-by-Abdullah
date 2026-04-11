import { prisma } from "@/lib/prisma";

/** Bank transfer orders without screenshot after 24h → cancelled + stock restored */
export async function autoCancelStaleBankOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: {
      paymentMethod: "bank_transfer",
      paymentStatus: "pending",
      orderStatus: { notIn: ["cancelled", "delivered", "shipped"] },
      createdAt: { lt: cutoff },
      AND: [
        { OR: [{ paymentScreenshot: null }, { paymentScreenshot: "" }] },
        { paymentProofData: null },
      ],
    },
    include: { orderItems: true },
  });

  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      for (const line of order.orderItems) {
        if (line.productId) {
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { increment: line.quantity } },
          });
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: { orderStatus: "cancelled", paymentStatus: "failed" },
      });
    });
  }
}
