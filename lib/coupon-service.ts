import { Prisma, type VendorCoupon } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";

export type CouponLine = {
  productId: string;
  vendorId?: string;
  category: string;
  categoryRecordId?: string | null;
  price: number;
  originalPrice?: number | null;
  quantity: number;
};

const ids = (value: Prisma.JsonValue | null): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export const cents = (value: number | string | Prisma.Decimal) => Math.round(Number(value) * 100);
export const money = (value: number) => new Prisma.Decimal((value / 100).toFixed(2));

export function normalizeCouponCode(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) throw new ApiError(400, "Enter a valid coupon code.");
  return code;
}

export function calculateCoupon(coupon: VendorCoupon, lines: CouponLine[], customerId: string, now = new Date()) {
  if (coupon.status !== "active") throw new ApiError(400, "Coupon is inactive.");
  if (coupon.startDate && coupon.startDate > now) throw new ApiError(400, "Coupon is not yet active.");
  if (coupon.expiryDate && coupon.expiryDate < now) throw new ApiError(400, "Coupon has expired.");
  if (coupon.ownerType === "ADMIN" && !coupon.approvedAt) throw new ApiError(400, "Coupon is not approved.");
  if (coupon.ownerType === "ADMIN") {
    const approved = ids(coupon.approvals);
    const targets = ids(coupon.selectedVendorIds);
    if (!targets.every(id => approved.includes(id))) throw new ApiError(400, "Vendor approval is required.");
  }
  const customers = ids(coupon.customerIds);
  if (customers.length && !customers.includes(customerId)) throw new ApiError(400, "Coupon is not available for this account.");
  const products = ids(coupon.productIds);
  const categories = ids(coupon.categories);
  const vendors = ids(coupon.selectedVendorIds);
  // Admin coupons must have an explicit target; legacy vendor coupons cover the vendor's inventory.
  if (coupon.ownerType === "ADMIN" && !products.length && !categories.length) throw new ApiError(400, "Coupon has no eligible products.");
  const eligible = lines.map((line, index) => ({ line, index })).filter(({ line }) => {
    if (coupon.ownerType === "VENDOR" && line.vendorId !== coupon.vendorId) return false;
    if (coupon.fundingType === "VENDOR_FUNDED" && !line.vendorId) return false;
    if (vendors.length && line.vendorId && !vendors.includes(line.vendorId)) return false;
    if (coupon.ownerType === "ADMIN" && line.vendorId && !vendors.includes(line.vendorId)) return false;
    if (products.length || categories.length) {
      if (!products.includes(line.productId) && !categories.includes(line.category)) return false;
    }
    // Existing deal prices already include their discount; never stack automatically.
    if (line.originalPrice && line.originalPrice > line.price) return false;
    return true;
  });
  if (!eligible.length) throw new ApiError(400, "No product in your cart is eligible for this coupon.");
  const base = eligible.reduce((sum, { line }) => sum + cents(line.price) * line.quantity, 0);
  if (base < cents(coupon.minOrderAmount)) throw new ApiError(400, "Minimum eligible purchase amount has not been reached.");
  const raw = coupon.discountType === "percent"
    ? Math.round(base * Number(coupon.discountValue) / 100)
    : cents(coupon.discountValue);
  const discount = Math.min(base, raw, coupon.maxDiscount ? cents(coupon.maxDiscount) : Infinity);
  if (discount <= 0) throw new ApiError(400, "Coupon has no available discount.");
  const allocations = eligible.map(({ line, index }) => ({ index, productId: line.productId, vendorId: line.vendorId || null, base: cents(line.price) * line.quantity, discount: 0 }));
  let left = discount;
  const remainders = allocations.map((row, index) => {
    const exact = row.base * discount / base;
    row.discount = Math.floor(exact);
    left -= row.discount;
    return { index, fraction: exact - row.discount };
  }).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < left; i++) allocations[remainders[i % remainders.length].index].discount++;
  return { discount, allocations, platformFunded: coupon.fundingType === "PLATFORM_FUNDED" ? discount : 0 };
}

export async function findCoupon(db: Prisma.TransactionClient, code: string) {
  const matches = await db.vendorCoupon.findMany({ where: { couponCode: code }, take: 2 });
  if (matches.length !== 1) throw new ApiError(400, "Coupon code is invalid.");
  return matches[0];
}
