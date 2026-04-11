import { prisma } from "@/lib/prisma";
import {
  ORDER_INCLUDE_SERIALIZE,
  type OrderWithSerializeRelations,
} from "@/lib/prisma-order-includes";
import { getVendorShopOrderDelegate } from "@/lib/prisma-vendor-shop-order";

export async function findOrderByIdOrNumber(
  ref: string
): Promise<OrderWithSerializeRelations | null> {
  const id = ref.trim();
  const include = ORDER_INCLUDE_SERIALIZE;

  if (id.toUpperCase().startsWith("IRB-")) {
    return prisma.order.findFirst({
      where: { orderNumber: id.toUpperCase() },
      include,
    });
  }
  if (id.toUpperCase().startsWith("IRV-")) {
    const slice = await getVendorShopOrderDelegate().findFirst({
      where: { shopOrderNumber: id.toUpperCase() },
      select: { orderId: true },
    });
    if (!slice) return null;
    return prisma.order.findUnique({
      where: { id: slice.orderId },
      include,
    });
  }
  return prisma.order.findUnique({
    where: { id },
    include,
  });
}
