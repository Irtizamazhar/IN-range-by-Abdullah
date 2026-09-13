export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { checkoutQuote } from "@/lib/offer-checkout-service";
import { ApiError } from "@/lib/marketplace-api";
import { resolveServiceAddon } from "@/lib/service-checkout-service";
import { getCustomerSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { autoCancelStaleBankOrders } from "@/lib/auto-cancel-orders";
import { generateOrderNumber } from "@/lib/order-number";
import { getOrCreateSettings } from "@/lib/settings-db";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import {
  ORDER_INCLUDE_SERIALIZE,
  WHERE_PARENT_ORDER_ONLY,
} from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { notifyAdminNewOrder } from "@/lib/order-emails";
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
  const auth = await requireAdminPermission("orders.view");
  if ("response" in auth) return auth.response;
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
  if (session?.user?.role !== "customer" || !session.user.id) {
    return NextResponse.json(
      { error: "Please sign in with a customer account to place an order" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const checkoutKey = String(
    req.headers.get("Idempotency-Key") || body.checkoutKey || ""
  ).trim();
  if (!/^[A-Za-z0-9:_-]{16,128}$/.test(checkoutKey)) {
    return NextResponse.json(
      { error: "A valid checkout idempotency key is required" },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, phone: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer account not found" }, { status: 401 });
  }

  const existingOrder = await prisma.order.findUnique({
    where: { checkoutKey },
    include: ORDER_INCLUDE_SERIALIZE,
  });
  if (existingOrder) {
    if (existingOrder.customerId !== customer.id) {
      return NextResponse.json({ error: "Checkout key conflict" }, { status: 409 });
    }
    return NextResponse.json(serializeOrder(existingOrder), {
      headers: { "X-Idempotent-Replay": "true" },
    });
  }

  type CartLine = {
    serviceId?: unknown;
    productId?: unknown;
    quantity?: unknown;
    variant?: unknown;
  };

  const {
    customerName,
    customerPhone,
    customerAddress,
    city,
    products: rawLines,
    paymentMethod,
  } = body as {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    city?: string;
    products?: CartLine[];
    paymentMethod?: string;
  };

  const lineItems: CartLine[] = Array.isArray(rawLines) ? rawLines : [];

  if (!lineItems?.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }
  if (!customerName || !customerPhone || !customerAddress || !city) {
    return NextResponse.json({ error: "Missing customer fields" }, { status: 400 });
  }
  if (paymentMethod && paymentMethod !== "cod") {
    return NextResponse.json(
      { error: "Only Cash on Delivery (COD) is available" },
      { status: 400 }
    );
  }

  const settings = await getOrCreateSettings();
  const effectivePaymentMethod = "cod";
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

  try {
  const quoteId = typeof body.quoteId === "string" ? body.quoteId : null;
  const quote = quoteId ? await checkoutQuote(prisma, quoteId, session.user.id, String(city)) : null;
  if (quote?.orderId) {
    const previous = await prisma.order.findUnique({ where: { id: quote.orderId }, include: ORDER_INCLUDE_SERIALIZE });
    if (!previous) throw new ApiError(409, "Please refresh your order history.");
    return NextResponse.json(serializeOrder(previous));
  }
  if (quote && (lineItems.length !== 1 || String(lineItems[0].productId) !== quote.revision.productId || Number(lineItems[0].quantity) !== quote.revision.quantity)) throw new ApiError(400, "Checkout the accepted quote on its own, with the agreed quantity. Remove other cart items first.");
  let subtotal = 0;
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
    if (
      !line || typeof line !== "object" ||
      (typeof line.quantity !== "number" && typeof line.quantity !== "string") ||
      !Number.isSafeInteger(Number(line.quantity)) || Number(line.quantity) < 1
    ) {
      return NextResponse.json({ error: "Invalid product quantity" }, { status: 400 });
    }
    const lineProductId = String(line.productId || "");
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
      include: {
        vendor: {
          select: {
            id: true,
            status: true,
            specialCommissionRate: true,
          },
        },
      },
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

    const unit = quote ? Number(quote.revision.price) : Number(p.price);
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

  const deliveryCharge = quote ? Number(quote.revision.shipping) : settings.codCharges || 0;
  const serviceInputs = lineItems.filter(line => line.serviceId != null).map(line => {
    if (typeof line.serviceId !== "string" || !line.serviceId || String(line.productId).startsWith("na-") || quote) throw new ApiError(400, "Service add-ons require a regular catalog product checkout.");
    return { serviceId: line.serviceId, productId: String(line.productId), quantity: Number(line.quantity) };
  });
  const services = await Promise.all(serviceInputs.map(s => resolveServiceAddon(prisma, s.productId, s.serviceId, s.quantity, String(city))));
  const serviceTotal = services.reduce((sum, s) => sum.add(s.price.mul(s.quantity)), new Prisma.Decimal(0));
  const totalAmount = new Prisma.Decimal(subtotal).add(deliveryCharge).add(serviceTotal).toDecimalPlaces(2);

  const orderNumber = await generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    // Interactive `tx` typings may lag `schema.prisma`; cast only the minimal delegate surface.
    const shopTx = tx as unknown as VendorShopOrderTx & {
      vendorShopOrder: {
        create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; paymentStatus: string }>;
      };
    };

    const mp = getMarketplaceTx(tx);

    if (quoteId) { const currentQuote = await checkoutQuote(tx, quoteId, session.user.id, String(city)); if (currentQuote.orderId) throw new ApiError(409, "Quote already checked out. Refresh your orders."); }
    for (const service of services) {
      const current = await resolveServiceAddon(tx, service.productId, service.serviceId, service.quantity, String(city));
      if (!current.price.equals(service.price) || !current.commissionAmount.equals(service.commissionAmount)) throw new ApiError(409, "Service terms changed. Refresh checkout before ordering.");
    }
    const o = await tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        checkoutKey,
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: customer.email,
        customerAddress: String(customerAddress).trim(),
        city: String(city).trim(),
        totalAmount,
        paymentMethod: effectivePaymentMethod,
        bankAccount: null,
        paymentScreenshot: null,
        paymentProofData: null,
        paymentProofMime: null,
        notes: null,
        // COD is not collected until fulfilment confirms delivery.
        paymentStatus: "pending",
        orderStatus: "confirmed",
        isRead: false,
      },
    });

    const createdOrderItems = [];
    for (const line of resolvedProducts) {
      createdOrderItems.push(
        await tx.orderItem.create({
          data: {
            orderId: o.id,
            productId: line.orderItemProductId,
            name: line.name,
            price: line.price,
            quantity: line.quantity,
            image: line.image,
            variant: line.variant ?? null,
          },
        })
      );
    }

    // One VendorShopOrder per vendor on this checkout (bundled lines) + linked VendorOrder rows.
    const vendorLines = resolvedProducts.filter((r) => r.vendorSlice);
    const groups = new Map<string, typeof resolvedProducts>();
    for (const line of vendorLines) {
      const vid = line.vendorSlice!.vendorId;
      if (!groups.has(vid)) groups.set(vid, []);
      groups.get(vid)!.push(line);
    }

    const shopOrderByVendor = new Map<string, string>();

    for (const [, lines] of Array.from(groups.entries())) {
      type ItemSnap = {
        productId: string | null;
        productName: string;
        image: string;
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
          image: line.image,
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
          customerId: customer.id,
          customerName: String(customerName).trim(),
          customerPhone: String(customerPhone).trim(),
          customerEmail: customer.email,
          customerAddress: String(customerAddress).trim(),
          city: String(city).trim(),
          items,
          totalAmount: new Prisma.Decimal(totalSale.toFixed(2)),
          commissionAmount: new Prisma.Decimal(totalComm.toFixed(2)),
          netAmount: new Prisma.Decimal(totalNet.toFixed(2)),
          paymentMethod: effectivePaymentMethod,
          paymentStatus: o.paymentStatus,
          status: "pending",
          statusHistory,
        },
      });
      shopOrderByVendor.set(vendorId, vso.id);

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

        const vendorStock = await tx.vendorProduct.updateMany({
          where: { id: vs.vendorProductId, stock: { gte: line.quantity } },
          data: {
            stock: { decrement: line.quantity },
            totalSold: { increment: line.quantity },
          },
        });
        if (vendorStock.count !== 1) throw new Error("Insufficient stock");

        await mp.vendor.update({
          where: { id: vs.vendorId },
          data: {
            totalOrders: { increment: 1 },
            totalSales: { increment: new Prisma.Decimal(saleAmount.toFixed(2)) },
          },
          // Avoid selecting full Vendor row because some DBs still miss newly-added columns.
          select: { id: true },
        });
      }
    }

    for (const line of resolvedProducts) {
      if (!line.decrementFromPrisma) continue;
      const productStock = await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (productStock.count !== 1) throw new Error("Insufficient stock");
    }

    for (const service of services) {
      await tx.orderService.create({ data: { ...service, orderId: o.id, events: { create: { actor: `customer:${session.user.email}`, status: "PENDING", note: "Service booked with product checkout." } } } });
    }
    if (quote) {
      const claimed = await tx.offerQuote.updateMany({ where: { id: quote.id, orderId: null }, data: { orderId: o.id } });
      if (claimed.count !== 1) throw new ApiError(409, "Quote already checked out.");
      await tx.want.update({ where: { id: quote.wantId }, data: { status: "FULFILLED" } });
    }

    for (let i = 0; i < resolvedProducts.length; i++) {
      const line = resolvedProducts[i]!;
      const orderItem = createdOrderItems[i]!;
      await tx.orderInventoryLine.create({
        data: {
          orderId: o.id,
          orderItemId: orderItem.id,
          productId: line.orderItemProductId,
          vendorProductId: line.vendorSlice?.vendorProductId ?? null,
          vendorShopOrderId: line.vendorSlice
            ? shopOrderByVendor.get(line.vendorSlice.vendorId) ?? null
            : null,
          quantity: line.quantity,
          state: "reserved",
        },
      });
    }

    await tx.orderStatusEvent.create({
      data: {
        orderId: o.id,
        actorType: "customer",
        actorId: customer.id,
        eventType: "order_created",
        toStatus: "confirmed",
        idempotencyKey: `checkout:${checkoutKey}`,
        details: {
          paymentMethod: effectivePaymentMethod,
          paymentStatus: "pending",
        },
      },
    });

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
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("POST /api/orders", e);
    if (e instanceof Error && e.message === "Insufficient stock") {
      return NextResponse.json(
        { error: "Stock changed during checkout. Please refresh your cart." },
        { status: 409 }
      );
    }
    const message =
      e instanceof Error ? e.message : "Could not place order";
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    if (code === "P2002") {
      const replay = await prisma.order.findUnique({
        where: { checkoutKey },
        include: ORDER_INCLUDE_SERIALIZE,
      });
      if (replay?.customerId === customer.id) {
        return NextResponse.json(serializeOrder(replay), {
          headers: { "X-Idempotent-Replay": "true" },
        });
      }
    }
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
