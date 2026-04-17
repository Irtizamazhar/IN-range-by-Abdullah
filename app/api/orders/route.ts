export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCustomerSession, getAdminSession } from "@/lib/sessions";
import { autoCancelStaleBankOrders } from "@/lib/auto-cancel-orders";
import { generateOrderNumber } from "@/lib/order-number";
import { getOrCreateSettings } from "@/lib/settings-db";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { readProducts } from "@/lib/products-store";
import {
  ORDER_INCLUDE_SERIALIZE,
  WHERE_PARENT_ORDER_ONLY,
} from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { notifyAdminNewOrder, notifyAdminScreenshotUploaded } from "@/lib/order-emails";
import { createVendorNotification } from "@/lib/vendor-notifications";
import { primaryProductImageUrl, serializeOrder } from "@/lib/serialize";
import { resolveCommissionPercent } from "@/lib/vendor-commission";
import {
  generateVendorShopOrderNumber,
  type VendorShopOrderTx,
} from "@/lib/vendor-shop-order-number";
import {
  getMarketplacePrisma,
  getMarketplaceTx,
} from "@/lib/marketplace-prisma";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await autoCancelStaleBankOrders();
  } catch (e) {
    console.error("autoCancelStaleBankOrders", e);
    // Continue loading orders even if maintenance job fails
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: Prisma.OrderWhereInput = {
    // Admin "Orders" page is storefront parent orders only (exclude seller-split bundles).
    ...WHERE_PARENT_ORDER_ONLY,
  };
  if (status && status !== "all") {
    where.orderStatus = status;
  }

  try {
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { orderItems: true },
    });
    const unread = await prisma.order.count({
      where: { ...where, isRead: false },
    });

    return NextResponse.json({
      orders: orders.map((o) => serializeOrder(o, { forAdmin: true })),
      unread,
    });
  } catch (e) {
    console.error("GET /api/orders", e);
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    const error =
      code === "P2032"
        ? "Database client out of sync (nullable order lines). Stop npm run dev, run npx prisma generate, then start dev again."
        : "Failed to load orders";
    return NextResponse.json(
      { error, orders: [], unread: 0 },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer") {
    return NextResponse.json(
      { error: "Please sign in with a customer account to place an order" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  type CartLine = {
    productId?: unknown;
    quantity?: unknown;
    variant?: unknown;
  };

  const {
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    city,
    products: rawLines,
    paymentMethod,
    bankAccount,
    paymentScreenshot,
    paymentProofStagingId,
    cardPaymentMeta,
  } = body as {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddress?: string;
    city?: string;
    products?: CartLine[];
    paymentMethod?: string;
    bankAccount?: string;
    paymentScreenshot?: string;
    paymentProofStagingId?: string;
    cardPaymentMeta?: {
      last4?: string;
      expiry?: string;
      holderName?: string;
    };
  };

  const lineItems: CartLine[] = Array.isArray(rawLines) ? rawLines : [];

  if (!lineItems?.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }
  if (!customerName || !customerPhone || !customerEmail || !customerAddress || !city) {
    return NextResponse.json({ error: "Missing customer fields" }, { status: 400 });
  }
  if (
    paymentMethod !== "bank_transfer" &&
    paymentMethod !== "cod" &&
    paymentMethod !== "card"
  ) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const settings = await getOrCreateSettings();

  let orderNotes: string | null = null;
  if (paymentMethod === "card") {
    const meta = cardPaymentMeta;
    const last4 = String(meta?.last4 || "").replace(/\D/g, "").slice(0, 4);
    const expiryRaw = String(meta?.expiry || "").trim();
    const expDigits = expiryRaw.replace(/\D/g, "").slice(0, 4);
    const exp =
      expDigits.length === 4
        ? `${expDigits.slice(0, 2)}/${expDigits.slice(2)}`
        : "";
    const holder = sanitizePlainText(String(meta?.holderName || ""), 120);
    const mm = parseInt(expDigits.slice(0, 2), 10);
    if (last4.length !== 4 || exp.length !== 5 || !holder.length) {
      return NextResponse.json(
        { error: "Please complete all card fields (last 4 digits required)" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(mm) || mm < 1 || mm > 12) {
      return NextResponse.json({ error: "Invalid card expiry month" }, { status: 400 });
    }
    orderNotes = `Card payment (manual verification): •••• ${last4} | Exp ${exp} | ${holder}`;
  }

  if (paymentMethod === "cod") {
    const allowed = settings.codAvailableCities.some(
      (cityName: string) =>
        cityName.toLowerCase() === String(city).trim().toLowerCase()
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "COD is not available in this city" },
        { status: 400 }
      );
    }
  }

  try {
  let subtotal = 0;
  const newArrivalStore = await readProducts();
  type VendorSlice = {
    vendorId: string;
    vendorProductId: string;
    category: string;
    vendorSpecialCommissionRate: Prisma.Decimal | null;
  };
  const resolvedProducts: Array<{
    productId: string;
    orderItemProductId: string | null;
    name: string;
    price: number;
    quantity: number;
    image: string;
    variant?: string;
    decrementFromPrisma: boolean;
    vendorSlice?: VendorSlice;
  }> = [];

  for (const line of lineItems) {
    const lineProductId = String(line.productId || "");
    if (lineProductId.startsWith("na-")) {
      const naId = Number(lineProductId.slice(3));
      const na = newArrivalStore.find((x) => Number(x.id) === naId && x.isNew);
      if (!na) {
        return NextResponse.json({ error: "Invalid product" }, { status: 400 });
      }
      const qty = Math.max(1, parseInt(String(line.quantity), 10));
      const naStock = Math.max(0, Number(na.stock ?? (na.inStock ? 1 : 0)));
      if (naStock < qty) {
        return NextResponse.json(
          { error: `Insufficient stock: ${na.name}` },
          { status: 400 }
        );
      }
      const unit = Number(na.price);
      subtotal += unit * qty;
      resolvedProducts.push({
        productId: lineProductId,
        orderItemProductId: null,
        name: na.name,
        price: unit,
        quantity: qty,
        image: (Array.isArray(na.images) && na.images[0]) || na.image || "",
        variant: line.variant ? String(line.variant) : undefined,
        decrementFromPrisma: false,
      });
      continue;
    }

    const p = await prisma.product.findUnique({
      where: { id: lineProductId },
      select: catalogProductSelect({ take: 1 }),
    });
    if (!p?.isActive) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }
    const qty = Math.max(1, parseInt(String(line.quantity), 10));
    if (p.stock < qty) {
      return NextResponse.json(
        { error: `Insufficient stock: ${p.name}` },
        { status: 400 }
      );
    }
    const variants = (p.variants as unknown as string[]) || [];
    const variantSel =
      line.variant != null && line.variant !== ""
        ? String(line.variant)
        : undefined;
    if (variants.length) {
      if (!variantSel || !variants.includes(variantSel)) {
        return NextResponse.json(
          { error: `Select a variant for ${p.name}` },
          { status: 400 }
        );
      }
    }

    const mpPre = getMarketplacePrisma();
    const vp = await mpPre.vendorProduct.findFirst({
      where: {
        publishedProductId: p.id,
        status: "active",
      },
      include: { vendor: true },
    });

    let vendorSlice: VendorSlice | undefined;
    if (vp) {
      if (vp.vendor.status !== "approved") {
        return NextResponse.json(
          { error: `This product is not available: ${p.name}` },
          { status: 400 }
        );
      }
      if (vp.stock < qty) {
        return NextResponse.json(
          { error: `Insufficient stock: ${p.name}` },
          { status: 400 }
        );
      }
      vendorSlice = {
        vendorId: vp.vendorId,
        vendorProductId: vp.id,
        category: vp.category,
        vendorSpecialCommissionRate: vp.vendor
          .specialCommissionRate as Prisma.Decimal | null,
      };
    }

    const unit = Number(p.price);
    subtotal += unit * qty;
    const imgUrl = primaryProductImageUrl(p);
    resolvedProducts.push({
      productId: p.id,
      orderItemProductId: p.id,
      name: p.name,
      price: unit,
      quantity: qty,
      image: imgUrl,
      variant: variantSel,
      decrementFromPrisma: true,
      vendorSlice,
    });
  }

  const deliveryCharge = settings.codCharges || 0;
  const totalAmount = subtotal + deliveryCharge;

  const orderNumber = await generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    // Interactive `tx` typings may lag `schema.prisma`; cast only the minimal delegate surface.
    const shopTx = tx as unknown as VendorShopOrderTx & {
      vendorShopOrder: {
        create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; paymentStatus: string }>;
      };
    };

    const mp = getMarketplaceTx(tx);

    let paymentProofData: Uint8Array<ArrayBuffer> | undefined;
    let paymentProofMime: string | undefined;
    let paymentShot: string | null = null;

    if (paymentMethod === "bank_transfer") {
      if (paymentProofStagingId) {
        const st = await tx.paymentProofStaging.findUnique({
          where: { id: String(paymentProofStagingId) },
        });
        if (st) {
          const raw = new Uint8Array(st.data);
          const copy = new Uint8Array(raw.byteLength);
          copy.set(raw);
          paymentProofData = copy as Uint8Array<ArrayBuffer>;
          paymentProofMime = st.mimeType;
          await tx.paymentProofStaging.delete({ where: { id: st.id } });
        }
      } else if (paymentScreenshot) {
        paymentShot = String(paymentScreenshot);
      }
    }

    const o = await tx.order.create({
      data: {
        orderNumber,
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: String(customerEmail).trim(),
        customerAddress: String(customerAddress).trim(),
        city: String(city).trim(),
        totalAmount,
        paymentMethod,
        bankAccount:
          paymentMethod === "bank_transfer" ? String(bankAccount || "") : null,
        paymentScreenshot:
          paymentMethod === "bank_transfer" && paymentShot ? paymentShot : null,
        paymentProofData,
        paymentProofMime,
        notes: orderNotes,
        paymentStatus:
          paymentMethod === "cod" ? "received" : "pending",
        orderStatus: paymentMethod === "cod" ? "confirmed" : "pending",
        isRead: false,
        orderItems: {
          create: resolvedProducts.map((r) => ({
            productId: r.orderItemProductId,
            name: r.name,
            price: r.price,
            quantity: r.quantity,
            image: r.image,
            variant: r.variant ?? null,
          })),
        },
      },
      include: { orderItems: true },
    });

    // One VendorShopOrder per vendor on this checkout (bundled lines) + linked VendorOrder rows.
    const vendorLines = resolvedProducts.filter((r) => r.vendorSlice);
    const groups = new Map<string, typeof resolvedProducts>();
    for (const line of vendorLines) {
      const vid = line.vendorSlice!.vendorId;
      if (!groups.has(vid)) groups.set(vid, []);
      groups.get(vid)!.push(line);
    }

    const customerEmailNorm = String(customerEmail).trim().toLowerCase();
    const customerRow = await tx.customer.findUnique({
      where: { email: customerEmailNorm },
      select: { id: true },
    });
    const customerIdForShop = customerRow?.id ?? null;

    for (const [, lines] of Array.from(groups.entries())) {
      type ItemSnap = {
        productId: string | null;
        productName: string;
        quantity: number;
        price: number;
        subtotal: number;
        vendorProductId: string;
        variant: string | null;
      };
      const items: ItemSnap[] = [];
      let totalSale = 0;
      let totalComm = 0;
      let totalNet = 0;
      const vendorId = lines[0]!.vendorSlice!.vendorId;

      for (const line of lines) {
        const vs = line.vendorSlice!;
        const saleAmount = line.price * line.quantity;
        const rate = await resolveCommissionPercent(
          mp,
          vs.category,
          vs.vendorSpecialCommissionRate
        );
        const commissionAmount =
          Math.round(((saleAmount * rate) / 100) * 100) / 100;
        const vendorAmount =
          Math.round((saleAmount - commissionAmount) * 100) / 100;
        totalSale += saleAmount;
        totalComm += commissionAmount;
        totalNet += vendorAmount;
        items.push({
          productId: line.orderItemProductId ?? line.productId,
          productName: line.name,
          quantity: line.quantity,
          price: line.price,
          subtotal: saleAmount,
          vendorProductId: vs.vendorProductId,
          variant: line.variant ? String(line.variant) : null,
        });
      }

      const shopOrderNumber = await generateVendorShopOrderNumber(shopTx);
      const statusHistory = [
        {
          status: "pending" as const,
          updatedAt: new Date().toISOString(),
          note: "Order placed",
        },
      ];

      const vso = await shopTx.vendorShopOrder.create({
        data: {
          shopOrderNumber,
          orderId: o.id,
          vendorId,
          customerId: customerIdForShop,
          customerName: String(customerName).trim(),
          customerPhone: String(customerPhone).trim(),
          customerEmail: String(customerEmail).trim(),
          customerAddress: String(customerAddress).trim(),
          city: String(city).trim(),
          items,
          totalAmount: new Prisma.Decimal(totalSale.toFixed(2)),
          commissionAmount: new Prisma.Decimal(totalComm.toFixed(2)),
          netAmount: new Prisma.Decimal(totalNet.toFixed(2)),
          paymentMethod: paymentMethod,
          paymentStatus: o.paymentStatus,
          status: "pending",
          statusHistory,
        },
      });

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const vs = line.vendorSlice!;
        const item = items[i]!;
        const saleAmount = item.subtotal;
        const rate = await resolveCommissionPercent(
          mp,
          vs.category,
          vs.vendorSpecialCommissionRate
        );
        const commissionAmount =
          Math.round(((saleAmount * rate) / 100) * 100) / 100;
        const vendorAmount =
          Math.round((saleAmount - commissionAmount) * 100) / 100;

        await mp.vendorOrder.create({
          data: {
            vendorId: vs.vendorId,
            orderId: o.id,
            vendorShopOrderId: vso.id,
            vendorProductId: vs.vendorProductId,
            customerName: String(customerName).trim(),
            customerPhone: String(customerPhone).trim(),
            quantity: line.quantity,
            saleAmount: new Prisma.Decimal(saleAmount.toFixed(2)),
            commissionRate: new Prisma.Decimal(rate.toFixed(2)),
            commissionAmount: new Prisma.Decimal(commissionAmount.toFixed(2)),
            vendorAmount: new Prisma.Decimal(vendorAmount.toFixed(2)),
            status: "pending",
          },
        });

        await mp.vendorProduct.update({
          where: { id: vs.vendorProductId },
          data: {
            stock: { decrement: line.quantity },
            totalSold: { increment: line.quantity },
          },
        });

        await mp.vendor.update({
          where: { id: vs.vendorId },
          data: {
            totalOrders: { increment: 1 },
            totalSales: { increment: new Prisma.Decimal(saleAmount.toFixed(2)) },
          },
        });
      }
    }

    for (const line of resolvedProducts) {
      if (!line.decrementFromPrisma) continue;
      await tx.product.update({
        where: { id: line.productId },
        data: { stock: { decrement: line.quantity } },
      });
    }

    return o;
  });

  const orderForClient = await prisma.order.findUnique({
    where: { id: order.id },
    include: ORDER_INCLUDE_SERIALIZE,
  });
  if (!orderForClient) {
    return NextResponse.json(
      { error: "Order was created but could not be loaded. Please refresh." },
      { status: 500 }
    );
  }
  const out = serializeOrder(orderForClient);
  try {
    await notifyAdminNewOrder({
      orderNumber: out.orderNumber,
      customerName: out.customerName,
      customerEmail: out.customerEmail,
      totalAmount: out.totalAmount,
    });
  } catch (e) {
    console.error("notifyAdminNewOrder", e);
  }

  if (
    paymentMethod === "bank_transfer" &&
    (out.paymentScreenshot || order.paymentProofData)
  ) {
    try {
      await notifyAdminScreenshotUploaded({
        orderNumber: out.orderNumber,
        customerName: out.customerName,
        customerEmail: out.customerEmail,
        totalAmount: out.totalAmount,
      });
    } catch (e) {
      console.error("notifyAdminScreenshotUploaded", e);
    }
  }

  try {
    const bundles = await prisma.vendorShopOrder.findMany({
      where: { orderId: order.id },
      select: {
        vendorId: true,
        shopOrderNumber: true,
        netAmount: true,
      },
    });
    for (const b of bundles) {
      await createVendorNotification({
        vendorId: b.vendorId,
        type: "order_new",
        title: "New order received",
        message: `You have a new order ${b.shopOrderNumber}. Net after commission (this bundle): Rs. ${Number(b.netAmount).toLocaleString("en-PK")}.`,
      });
    }
  } catch (e) {
    console.error("vendor new-order notifications", e);
  }

  return NextResponse.json(out);
  } catch (e) {
    console.error("POST /api/orders", e);
    const message =
      e instanceof Error ? e.message : "Could not place order";
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    const hint =
      code === "P2002"
        ? "Duplicate conflict — try again."
        : code === "P2025"
          ? "Record not found — refresh and try again."
          : "Please try again or contact support.";
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `${message} (${hint})`
            : `Could not place order. ${hint}`,
      },
      { status: 500 }
    );
  }
}
