/**
 * One-time: create VendorShopOrder rows for legacy VendorOrder lines that have
 * `vendorShopOrderId` null (grouped by parent order + vendor).
 *
 * Run after `npx prisma db push` / migrate:
 *   npx tsx scripts/backfill-vendor-shop-orders.ts
 */
import "dotenv/config";
import {
  PrismaClient,
  Prisma,
  type VendorShopOrderStatus,
} from "@prisma/client";
import {
  generateVendorShopOrderNumber,
  type VendorShopOrderTx,
} from "../lib/vendor-shop-order-number";
import { prisma as prismaRoot } from "../lib/prisma";
import { appendStatusHistory } from "../lib/vendor-shop-order-helpers";

const prisma = new PrismaClient();

type ShopTx = VendorShopOrderTx & {
  vendorShopOrder: Pick<typeof prismaRoot.vendorShopOrder, "create">;
};

function inferShopStatus(lines: { status: string }[]): VendorShopOrderStatus {
  if (lines.some((l) => l.status === "cancelled")) return "cancelled";
  if (lines.every((l) => l.status === "delivered")) return "delivered";
  if (lines.some((l) => l.status === "shipped")) return "shipped";
  if (lines.every((l) => l.status === "processing")) return "packed";
  if (lines.some((l) => l.status === "processing")) return "confirmed";
  return "pending";
}

async function main() {
  const orphans = await prisma.vendorOrder.findMany({
    where: { vendorShopOrderId: null },
    include: {
      vendorProduct: { select: { productName: true } },
      order: true,
    },
  });

  if (orphans.length === 0) {
    console.log("No legacy vendor orders to backfill.");
    return;
  }

  const groups = new Map<string, typeof orphans>();
  for (const row of orphans) {
    const key = `${row.orderId}::${row.vendorId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  for (const [, lines] of Array.from(groups.entries())) {
    const first = lines[0]!;
    const o = first.order;
    const shopStatus = inferShopStatus(lines);

    let totalSale = 0;
    let totalComm = 0;
    let totalNet = 0;
    const items = lines.map((l) => {
      const sub = Number(l.saleAmount);
      totalSale += sub;
      totalComm += Number(l.commissionAmount);
      totalNet += Number(l.vendorAmount);
      return {
        productId: null as string | null,
        productName: l.vendorProduct?.productName ?? "Product",
        quantity: l.quantity,
        price: l.quantity ? sub / l.quantity : sub,
        subtotal: sub,
        vendorProductId: l.vendorProductId,
        variant: null as string | null,
      };
    });

    const customerRow = await prisma.customer.findUnique({
      where: { email: o.customerEmail.trim().toLowerCase() },
      select: { id: true },
    });

    let createdNumber = "";
    await prisma.$transaction(async (tx) => {
      const shopTx = tx as unknown as ShopTx;
      const shopOrderNumber = await generateVendorShopOrderNumber(shopTx);
      createdNumber = shopOrderNumber;
      const statusHistory = appendStatusHistory([], {
        status: shopStatus,
        updatedAt: new Date().toISOString(),
        note: "Backfilled from legacy line items",
      });

      const vso = await shopTx.vendorShopOrder.create({
        data: {
          shopOrderNumber,
          orderId: o.id,
          vendorId: first.vendorId,
          customerId: customerRow?.id ?? null,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          customerEmail: o.customerEmail,
          customerAddress: o.customerAddress,
          city: o.city,
          items,
          totalAmount: new Prisma.Decimal(totalSale.toFixed(2)),
          commissionAmount: new Prisma.Decimal(totalComm.toFixed(2)),
          netAmount: new Prisma.Decimal(totalNet.toFixed(2)),
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          status: shopStatus,
          statusHistory,
          trackingNumber: lines.find((l) => l.trackingNumber)?.trackingNumber ?? null,
        },
      });

      for (const l of lines) {
        await tx.vendorOrder.update({
          where: { id: l.id },
          data: { vendorShopOrderId: vso.id },
        });
      }
    });

    console.log("Backfilled bundle", createdNumber, "lines", lines.length);
  }

  console.log("Done. Groups:", groups.size);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
