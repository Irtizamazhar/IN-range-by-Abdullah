import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import { couponCodeOrRandom, couponInput } from "@/lib/coupon-input";
export const dynamic = "force-dynamic";

export async function GET() { return api(async () => {
  const auth = await requireApprovedVendorApi(); if ("response" in auth) throw new ApiError(403, "Approved vendor required.");
  const vendorId = auth.vendor.id;
  const earnings = await prisma.$queryRaw<Array<{ couponId: string; amount: Prisma.Decimal }>>`
    SELECT cr.couponId, COALESCE(SUM(vo.vendorAmount), 0) AS amount
    FROM couponredemption cr JOIN vendororder vo ON vo.orderId = cr.orderId
    WHERE vo.vendorId = ${vendorId} AND cr.status = 'redeemed'
    GROUP BY cr.couponId
  `;
  return {
    vendorId,
    affectedOrderEarnings: Object.fromEntries(earnings.map(row => [row.couponId, Number(row.amount)])),
    coupons: await prisma.vendorCoupon.findMany({ where: { vendorId, ownerType: "VENDOR" }, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { redemptions: true } } } }),
    campaigns: (await prisma.vendorCoupon.findMany({ where: { ownerType: "ADMIN" }, orderBy: { createdAt: "desc" }, take: 200 })).filter(c => Array.isArray(c.selectedVendorIds) && c.selectedVendorIds.includes(vendorId)),
    products: await prisma.vendorProduct.findMany({ where: { vendorId, status: "active", publishedProductId: { not: null } }, select: { id: true, productName: true, publishedProductId: true, category: true }, take: 500 }),
  };
}); }

export async function POST(request: NextRequest) { return api(async () => {
  sameOrigin(request);
  const auth = await requireApprovedVendorApi(); if ("response" in auth) throw new ApiError(403, "Approved vendor required.");
  const input = couponInput.parse(await request.json());
  const vendorId = auth.vendor.id;
  if (input.selectedVendorIds.length || input.customerIds.length || input.collectionIds.length || input.fundingType !== "VENDOR_FUNDED") throw new ApiError(400, "Vendor coupon targeting is invalid.");
  if (input.productIds.length) {
    const owned = await prisma.vendorProduct.count({ where: { vendorId, status: "active", publishedProductId: { in: input.productIds } } });
    if (owned !== new Set(input.productIds).size) throw new ApiError(403, "Select only your published products.");
  }
  if (input.categories.length) {
    const owned = await prisma.vendorProduct.findMany({ where: { vendorId, category: { in: input.categories } }, select: { category: true } });
    if (new Set(owned.map(p => p.category)).size !== new Set(input.categories).size) throw new ApiError(403, "Select only your own categories.");
  }
  const code = couponCodeOrRandom(input.couponCode);
  if (await prisma.vendorCoupon.count({ where: { couponCode: code } })) throw new ApiError(409, "Coupon code already exists.");
  const coupon = await prisma.vendorCoupon.create({ data: { vendorId, couponCode: code, codeKey: code, discountType: input.discountType, discountValue: input.discountValue, minOrderAmount: input.minOrderAmount, maxDiscount: input.maxDiscount, startDate: input.startDate ? new Date(input.startDate) : null, expiryDate: input.expiryDate ? new Date(input.expiryDate) : null, productIds: input.productIds, categories: input.categories, maxUses: input.maxUses, perCustomerLimit: input.perCustomerLimit, status: "active" } });
  return { coupon };
}); }

export async function PATCH(request: NextRequest) { return api(async () => {
  sameOrigin(request);
  const auth = await requireApprovedVendorApi(); if ("response" in auth) throw new ApiError(403, "Approved vendor required.");
  const body = await request.json();
  if (body.action === "approve_campaign" || body.action === "reject_campaign") {
    const campaign = await prisma.vendorCoupon.findFirst({ where: { id: String(body.id), ownerType: "ADMIN" } });
    if (!campaign || !Array.isArray(campaign.selectedVendorIds) || !campaign.selectedVendorIds.includes(auth.vendor.id)) throw new ApiError(404, "Campaign not found.");
    return prisma.$transaction(async tx => {
      const current = await tx.vendorCoupon.findUniqueOrThrow({ where: { id: campaign.id } });
      if (!Array.isArray(current.selectedVendorIds) || !current.selectedVendorIds.includes(auth.vendor.id)) throw new ApiError(404, "Campaign not found.");
      const approvals = Array.isArray(current.approvals) ? current.approvals.filter((x): x is string => typeof x === "string") : [];
      const next = body.action === "approve_campaign" ? Array.from(new Set([...approvals, auth.vendor.id])) : approvals.filter(id => id !== auth.vendor.id);
      const updated = await tx.vendorCoupon.update({ where: { id: campaign.id }, data: { approvals: next, status: body.action === "reject_campaign" ? "paused" : current.status } });
      await tx.marketplaceAudit.create({ data: { actor: `vendor:${auth.vendor.id}`, target: campaign.id, action: body.action.toUpperCase(), reason: String(body.reason || "Vendor decision").slice(0, 500) } });
      return { coupon: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  const input = couponInput.parse(body);
  if (!input.id) throw new ApiError(400, "Coupon id is required.");
  const existing = await prisma.vendorCoupon.findFirst({ where: { id: input.id, vendorId: auth.vendor.id, ownerType: "VENDOR" } });
  if (!existing) throw new ApiError(404, "Coupon not found.");
  if (input.maxUses != null && input.maxUses < existing.usedCount) throw new ApiError(400, "Usage limit cannot be below existing redemptions.");
  if (input.productIds.length && await prisma.vendorProduct.count({ where: { vendorId: auth.vendor.id, publishedProductId: { in: input.productIds } } }) !== new Set(input.productIds).size) throw new ApiError(403, "Select only your products.");
  if (input.categories.length) {
    const owned = await prisma.vendorProduct.findMany({ where: { vendorId: auth.vendor.id, category: { in: input.categories } }, select: { category: true } });
    if (new Set(owned.map(p => p.category)).size !== new Set(input.categories).size) throw new ApiError(403, "Select only your own categories.");
  }
  const coupon = await prisma.vendorCoupon.update({ where: { id: existing.id }, data: { discountType: input.discountType, discountValue: input.discountValue, minOrderAmount: input.minOrderAmount, maxDiscount: input.maxDiscount, startDate: input.startDate ? new Date(input.startDate) : null, expiryDate: input.expiryDate ? new Date(input.expiryDate) : null, productIds: input.productIds, categories: input.categories, maxUses: input.maxUses, perCustomerLimit: input.perCustomerLimit } });
  return { coupon };
}); }

export async function PUT(request: NextRequest) { return api(async () => {
  sameOrigin(request);
  const auth = await requireApprovedVendorApi(); if ("response" in auth) throw new ApiError(403, "Approved vendor required.");
  const body = await request.json();
  if (!["active", "paused", "inactive"].includes(body.status)) throw new ApiError(400, "Invalid coupon status.");
  const gate = await prisma.vendorCoupon.updateMany({ where: { id: String(body.id), vendorId: auth.vendor.id, ownerType: "VENDOR" }, data: { status: body.status } });
  if (!gate.count) throw new ApiError(404, "Coupon not found.");
  return { ok: true };
}); }
