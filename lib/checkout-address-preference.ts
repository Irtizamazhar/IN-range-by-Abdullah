import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { addressSchema } from "@/lib/customer-address-schema";
import { addressSelect } from "@/lib/customer-address-service";

/** Called under the existing customer-address lock, only after a committed checkout. */
export async function saveOrderAddress(tx: Prisma.TransactionClient, customerId: string, orderId: string) {
  const order = await tx.order.findFirst({ where: { id: orderId, customerId }, select: { id: true, customerName: true, customerPhone: true, customerAddress: true, city: true, statusEvents: { where: { eventType: "order_created" }, select: { details: true }, take: 1 } } });
  if (!order) throw new ApiError(404, "Order not found.");
  const key = `checkout-address:${order.id}`;
  if (await tx.orderStatusEvent.findUnique({ where: { idempotencyKey: key }, select: { id: true } })) return { saved: true };
  const details = order.statusEvents[0]?.details as { addresses?: { shipping?: { postalCode?: string } } } | null;
  const data = addressSchema.parse({ label: "Home", recipientName: order.customerName, phone: order.customerPhone, address: order.customerAddress, city: order.city, postalCode: details?.addresses?.shipping?.postalCode || null, isDefault: true });
  const existing = await tx.customerAddress.findFirst({ where: { customerId, isDefault: true }, select: { id: true, label: true } });
  const address = existing
    ? await tx.customerAddress.update({ where: { id: existing.id, customerId }, data: { ...data, label: existing.label }, select: addressSelect })
    : await tx.customerAddress.create({ data: { ...data, customerId }, select: addressSelect });
  await tx.orderStatusEvent.create({ data: { orderId: order.id, actorType: "customer", actorId: customerId, eventType: "checkout_address_saved", idempotencyKey: key, details: { addressId: address.id } } });
  return { saved: true };
}
