import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { couponCodeOrRandom, couponInput } from "@/lib/coupon-input";
export const dynamic = "force-dynamic";

async function productTargets(productIds: string[], collectionIds: string[]) {
  const collections = await prisma.couponCollection.findMany({ where: { id: { in: collectionIds } } });
  if (collections.length !== new Set(collectionIds).size) throw new ApiError(400, "Select valid collections.");
  const targets = Array.from(new Set([...productIds, ...collections.flatMap(c => Array.isArray(c.productIds) ? c.productIds.filter((x): x is string => typeof x === "string") : [])]));
  if (targets.length && await prisma.product.count({ where: { id: { in: targets }, isActive: true } }) !== targets.length) throw new ApiError(400, "Select active products only.");
  return targets;
}

async function validateFundedVendors(vendorIds: string[], productIds: string[], categories: string[]) {
  if (!vendorIds.length) throw new ApiError(400, "Select vendors who must approve funding.");
  const rows = await prisma.vendorProduct.findMany({ where: { vendorId: { in: vendorIds }, status: "active", publishedProductId: { not: null } }, select: { vendorId: true, publishedProductId: true, category: true } });
  const eligible = new Set(rows.filter(row => productIds.includes(row.publishedProductId || "") || categories.includes(row.category)).map(row => row.vendorId));
  if (vendorIds.some(id => !eligible.has(id))) throw new ApiError(400, "Each funding vendor needs at least one targeted product.");
}

async function effectiveVendorTargets(selected: string[], productIds: string[], categories: string[]) {
  if (selected.length) return selected;
  const rows = await prisma.vendorProduct.findMany({ where: { status: "active", publishedProductId: { not: null } }, select: { vendorId: true, publishedProductId: true, category: true } });
  return Array.from(new Set(rows.filter(row => productIds.includes(row.publishedProductId || "") || categories.includes(row.category)).map(row => row.vendorId)));
}

export async function GET() { const auth = await requireAdminPermission("coupons.manage"); if ("response" in auth) return auth.response;
  return api(async () => ({
    coupons: await prisma.vendorCoupon.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { vendor: { select: { shopName: true } }, _count: { select: { redemptions: true } } } }),
    vendors: await prisma.vendor.findMany({ where: { status: "approved" }, select: { id: true, shopName: true }, take: 500 }),
    products: await prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, category: true, vendorPublication: { select: { vendorId: true } } }, take: 1000 }),
    collections: await prisma.couponCollection.findMany({ orderBy: { name: "asc" }, take: 200 }),
    audit: await prisma.adminAuditLog.findMany({ where: { entityType: "VendorCoupon" }, select: { id: true, action: true, entityId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    repeatUsage: (await prisma.$queryRaw<Array<{ couponId: string; customerId: string; uses: bigint }>>`
      SELECT couponId, customerId, COUNT(*) AS uses FROM couponredemption
      WHERE status = 'redeemed' GROUP BY couponId, customerId HAVING COUNT(*) >= 3 LIMIT 50
    `).map(row => ({ couponId: row.couponId, customerId: row.customerId, uses: Number(row.uses) })),
    platformSpending: (await prisma.$queryRaw<Array<{ couponId: string; gross: Prisma.Decimal; reversed: Prisma.Decimal }>>`
      SELECT cr.couponId, SUM(cr.platformFunded) AS gross, SUM(COALESCE(rr.reversed, 0)) AS reversed
      FROM couponredemption cr
      LEFT JOIN (SELECT orderId, SUM(couponPlatformReversal) AS reversed FROM refund WHERE status = 'processed' GROUP BY orderId) rr ON rr.orderId = cr.orderId
      WHERE cr.status = 'redeemed' GROUP BY cr.couponId
    `).map(row => ({ couponId: row.couponId, gross: Number(row.gross), reversed: Number(row.reversed), net: Number(row.gross) - Number(row.reversed) })),
  }));
}

export async function POST(request: NextRequest) { const auth = await requireAdminPermission("coupons.manage"); if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request);
    const input = couponInput.parse(await request.json());
    const targets = await productTargets(input.productIds, input.collectionIds);
    if (!targets.length && !input.categories.length) throw new ApiError(400, "Select eligible products or categories.");
    const vendorTargets = await effectiveVendorTargets(input.selectedVendorIds, targets, input.categories);
    if (input.fundingType === "VENDOR_FUNDED") await validateFundedVendors(vendorTargets, targets, input.categories);
    if (input.selectedVendorIds.length && await prisma.vendor.count({ where: { id: { in: input.selectedVendorIds }, status: "approved" } }) !== new Set(input.selectedVendorIds).size) throw new ApiError(400, "Select approved vendors only.");
    if (input.customerIds.length && await prisma.customer.count({ where: { id: { in: input.customerIds }, isActive: true } }) !== new Set(input.customerIds).size) throw new ApiError(400, "Select active customers only.");
    const code = couponCodeOrRandom(input.couponCode);
    if (await prisma.vendorCoupon.count({ where: { couponCode: code } })) throw new ApiError(409, "Coupon code already exists.");
    const coupon = await prisma.vendorCoupon.create({ data: { vendorId: null, ownerType: "ADMIN", fundingType: input.fundingType, couponCode: code, codeKey: code, discountType: input.discountType, discountValue: input.discountValue, minOrderAmount: input.minOrderAmount, maxDiscount: input.maxDiscount, startDate: input.startDate ? new Date(input.startDate) : null, expiryDate: input.expiryDate ? new Date(input.expiryDate) : null, productIds: targets, categories: input.categories, collectionIds: input.collectionIds, selectedVendorIds: vendorTargets, customerIds: input.customerIds, maxUses: input.maxUses, perCustomerLimit: input.perCustomerLimit, budget: input.budget, approvals: [], status: "inactive" } });
    await writeAdminAudit(prisma, { adminId: auth.admin.id, action: "COUPON_CREATED", entityType: "VendorCoupon", entityId: coupon.id, details: { fundingType: coupon.fundingType, code } });
    return { coupon };
  });
}

export async function PATCH(request: NextRequest) { const auth = await requireAdminPermission("coupons.manage"); if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request);
    const input = couponInput.parse(await request.json());
    if (!input.id) throw new ApiError(400, "Coupon id is required.");
    const existing = await prisma.vendorCoupon.findFirst({ where: { id: input.id, ownerType: "ADMIN" } });
    if (!existing) throw new ApiError(404, "Coupon not found.");
    const targets = await productTargets(input.productIds, input.collectionIds);
    if (!targets.length && !input.categories.length) throw new ApiError(400, "Select eligible products or categories.");
    const vendorTargets = await effectiveVendorTargets(input.selectedVendorIds, targets, input.categories);
    if (input.maxUses != null && input.maxUses < existing.usedCount) throw new ApiError(400, "Usage limit cannot be below existing redemptions.");
    if (input.budget != null && input.budget < Number(existing.spent)) throw new ApiError(400, "Budget cannot be below existing promotional spending.");
    if (input.fundingType === "VENDOR_FUNDED") await validateFundedVendors(vendorTargets, targets, input.categories);
    if (input.selectedVendorIds.length && await prisma.vendor.count({ where: { id: { in: input.selectedVendorIds }, status: "approved" } }) !== new Set(input.selectedVendorIds).size) throw new ApiError(400, "Select approved vendors only.");
    if (input.customerIds.length && await prisma.customer.count({ where: { id: { in: input.customerIds }, isActive: true } }) !== new Set(input.customerIds).size) throw new ApiError(400, "Select active customers only.");
    const materialChange = JSON.stringify({ fundingType: existing.fundingType, vendors: existing.selectedVendorIds, products: existing.productIds, categories: existing.categories, discountType: existing.discountType, discount: Number(existing.discountValue), maxDiscount: existing.maxDiscount && Number(existing.maxDiscount), minimum: Number(existing.minOrderAmount), maxUses: existing.maxUses, perCustomerLimit: existing.perCustomerLimit, budget: existing.budget && Number(existing.budget), start: existing.startDate?.toISOString() || null, expiry: existing.expiryDate?.toISOString() || null }) !== JSON.stringify({ fundingType: input.fundingType, vendors: vendorTargets, products: targets, categories: input.categories, discountType: input.discountType, discount: input.discountValue, maxDiscount: input.maxDiscount || null, minimum: input.minOrderAmount, maxUses: input.maxUses || null, perCustomerLimit: input.perCustomerLimit || null, budget: input.budget || null, start: input.startDate || null, expiry: input.expiryDate || null });
    const coupon = await prisma.vendorCoupon.update({ where: { id: existing.id }, data: { fundingType: input.fundingType, discountType: input.discountType, discountValue: input.discountValue, minOrderAmount: input.minOrderAmount, maxDiscount: input.maxDiscount, startDate: input.startDate ? new Date(input.startDate) : null, expiryDate: input.expiryDate ? new Date(input.expiryDate) : null, productIds: targets, categories: input.categories, collectionIds: input.collectionIds, selectedVendorIds: vendorTargets, customerIds: input.customerIds, maxUses: input.maxUses, perCustomerLimit: input.perCustomerLimit, budget: input.budget, ...(materialChange ? { approvals: [], approvedAt: null, approvedBy: null, status: "inactive" as const } : {}) } });
    await writeAdminAudit(prisma, { adminId: auth.admin.id, action: "COUPON_UPDATED", entityType: "VendorCoupon", entityId: coupon.id, details: { materialChange } });
    return { coupon };
  });
}

export async function PUT(request: NextRequest) { const auth = await requireAdminPermission("coupons.manage"); if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request);
    const body = await request.json();
    if (!["active", "paused", "inactive", "expired"].includes(body.status)) throw new ApiError(400, "Invalid coupon status.");
    return prisma.$transaction(async tx => {
      const coupon = await tx.vendorCoupon.findFirst({ where: { id: String(body.id), ownerType: "ADMIN" } });
      if (!coupon) throw new ApiError(404, "Coupon not found.");
      if (body.status === "active") {
        if (coupon.expiryDate && coupon.expiryDate < new Date()) throw new ApiError(400, "Coupon has expired.");
        const targets = Array.isArray(coupon.selectedVendorIds) ? coupon.selectedVendorIds : [];
        const approvals = Array.isArray(coupon.approvals) ? coupon.approvals : [];
        if (!targets.every(id => approvals.includes(id))) throw new ApiError(400, "All targeted vendors must approve this campaign.");
      }
      const updated = await tx.vendorCoupon.update({ where: { id: coupon.id }, data: { status: body.status, ...(body.status === "active" ? { approvedAt: new Date(), approvedBy: auth.admin.email } : {}) } });
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: `COUPON_${String(body.status).toUpperCase()}`, entityType: "VendorCoupon", entityId: coupon.id, details: { reason: String(body.reason || "") } });
      return { coupon: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}
