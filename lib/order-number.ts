import { prisma } from "@/lib/prisma";

export async function generateOrderNumber(): Promise<string> {
  const last = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });
  let next = 1;
  if (last?.orderNumber) {
    const m = last.orderNumber.match(/IRB-(\d+)/i);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `IRB-${String(next).padStart(3, "0")}`;
}
