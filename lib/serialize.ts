import type {
  Order,
  OrderItem,
  Prisma,
  Product,
  ProductImage,
} from "@prisma/client";
import { resolveCustomerOrderTrackStatus } from "@/lib/order-track-status";

/** DB row shape for serialization (includes vendor listing URLs when present). */
export type ProductSerializeInput = Pick<
  Product,
  | "id"
  | "name"
  | "description"
  | "price"
  | "originalPrice"
  | "discountPercent"
  | "category"
  | "stock"
  | "variants"
  | "isActive"
  | "listingImageUrls"
  | "createdAt"
  | "updatedAt"
> & {
  /** Present when Prisma client + DB include `Product.isBestSeller` (admin list). */
  isBestSeller?: boolean;
  productImages?: Pick<ProductImage, "id" | "sortOrder">[] | ProductImage[];
};

export function productImageListFromDb(
  rows: Pick<ProductImage, "id" | "sortOrder">[] | ProductImage[] | undefined
): string[] {
  if (!rows?.length) return [];
  return [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((im) => `/api/image/${im.id}`);
}

function listingImageUrlsFromProduct(p: ProductSerializeInput): string[] | null {
  const raw = p.listingImageUrls;
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const urls = raw.map((x) => String(x || "").trim()).filter(Boolean);
  return urls.length > 0 ? urls : null;
}

/** Prefer vendor `listingImageUrls` when set; otherwise blob-backed `ProductImage` URLs. */
export function productImagesForProduct(p: ProductSerializeInput): string[] {
  const listed = listingImageUrlsFromProduct(p);
  if (listed) return listed;
  return productImageListFromDb(p.productImages);
}

export function primaryProductImageUrl(p: ProductSerializeInput): string {
  const imgs = productImagesForProduct(p);
  return imgs[0] || "";
}

export function serializeProduct(
  p: ProductSerializeInput,
  opts?: { forAdmin?: boolean }
) {
  const images = productImagesForProduct(p);
  return {
    _id: p.id,
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    originalPrice:
      p.originalPrice != null ? Number(p.originalPrice) : undefined,
    discountPercent: p.discountPercent,
    images,
    imageIds: opts?.forAdmin
      ? [...(p.productImages || [])]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((x) => x.id)
      : undefined,
    category: p.category,
    stock: p.stock,
    variants: Array.isArray(p.variants)
      ? (p.variants as string[])
      : (p.variants as unknown as string[]) || [],
    isActive: p.isActive,
    ...(opts?.forAdmin
      ? { isBestSeller: Boolean((p as { isBestSeller?: boolean }).isBestSeller) }
      : {}),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** When customer tracks `IRV-…`, only that seller slice should drive status (not other vendors on same IRB). */
function vendorShopsForCustomerView(
  shops: { status: string; shopOrderNumber?: string | null }[] | undefined,
  ref: string | undefined
): { status: string; shopOrderNumber?: string | null }[] | undefined {
  if (!shops?.length || !ref?.trim()) return shops;
  const u = ref.trim().toUpperCase();
  if (!u.startsWith("IRV-")) return shops;
  const hit = shops.filter(
    (s) => String(s.shopOrderNumber || "").toUpperCase() === u
  );
  return hit.length ? hit : shops;
}

export function serializeOrder(
  order: Order & {
    orderItems: OrderItem[];
    vendorShopOrders?: { status: string; shopOrderNumber?: string | null }[];
  },
  opts?: { forAdmin?: boolean; vendorShopOrderRef?: string }
) {
  const shops = opts?.forAdmin
    ? order.vendorShopOrders
    : vendorShopsForCustomerView(order.vendorShopOrders, opts?.vendorShopOrderRef);

  const orderStatus =
    opts?.forAdmin || !shops?.length
      ? order.orderStatus
      : resolveCustomerOrderTrackStatus(order.orderStatus, shops);

  const publicShopOrderNumber =
    !opts?.forAdmin && shops?.length === 1
      ? (shops[0]?.shopOrderNumber ?? null)
      : null;

  return {
    _id: order.id,
    id: order.id,
    orderNumber: publicShopOrderNumber || order.orderNumber,
    parentOrderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    customerAddress: order.customerAddress,
    city: order.city,
    totalAmount: Number(order.totalAmount),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentRejectedReason: order.paymentRejectedReason,
    paymentScreenshot: order.paymentScreenshot,
    ...(opts?.forAdmin && order.paymentProofData
      ? {
          paymentProofUrl: `/api/order-payment/${order.id}`,
        }
      : {}),
    bankAccount: order.bankAccount,
    orderStatus,
    isRead: order.isRead,
    trackingNumber: order.trackingNumber,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    products: order.orderItems.map((i) => ({
      _id: i.id,
      id: i.id,
      productId: i.productId,
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      image: i.image,
      variant: i.variant,
    })),
  };
}
