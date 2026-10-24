import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { safeAccountLink } from "@/lib/customer-account-policy";
import { notificationUnreadCounts } from "@/lib/customer-notification-display";
export const dynamic = "force-dynamic";

/** Thumbnail for each notification, resolved from the entity its link points to — only entities this customer owns. */
async function notificationImages(customerId: string, links: (string | null)[]) {
  const wantIds = new Set<string>(), offerIds = new Set<string>(), orderNumbers = new Set<string>();
  for (const link of links) {
    if (!link) continue;
    const url = new URL(link, "https://account.invalid");
    const want = url.pathname.match(/^\/wants\/([^/]+)$/);
    if (want) wantIds.add(want[1]);
    else if (url.pathname === "/account/offers" && url.hash.length > 1) offerIds.add(url.hash.slice(1));
    else if (url.pathname === "/track-order" && url.searchParams.get("order")) orderNumbers.add(url.searchParams.get("order")!);
  }
  const numbers = Array.from(orderNumbers);
  const [wants, offers, orders, shopOrders] = await Promise.all([
    wantIds.size ? prisma.want.findMany({ where: { id: { in: Array.from(wantIds) }, customerId }, select: { id: true, photo: true } }) : [],
    offerIds.size ? prisma.wantOffer.findMany({ where: { id: { in: Array.from(offerIds) }, want: { customerId } }, select: { id: true, want: { select: { photo: true } }, vendor: { select: { shopLogo: true } } } }) : [],
    numbers.length ? prisma.order.findMany({ where: { orderNumber: { in: numbers }, customerId }, select: { orderNumber: true, orderItems: { select: { image: true }, where: { image: { not: "" } }, take: 1 } } }) : [],
    numbers.length ? prisma.vendorShopOrder.findMany({ where: { shopOrderNumber: { in: numbers }, order: { customerId } }, select: { shopOrderNumber: true, vendor: { select: { shopLogo: true } }, order: { select: { orderItems: { select: { image: true }, where: { image: { not: "" } }, take: 1 } } } } }) : [],
  ]);
  const byKey = new Map<string, string | null>();
  for (const w of wants) byKey.set(`want:${w.id}`, w.photo || null);
  for (const o of offers) byKey.set(`offer:${o.id}`, o.want.photo || o.vendor.shopLogo || null);
  for (const o of orders) byKey.set(`order:${o.orderNumber}`, o.orderItems[0]?.image || null);
  for (const s of shopOrders) byKey.set(`order:${s.shopOrderNumber}`, s.order.orderItems[0]?.image || s.vendor.shopLogo || null);
  return (link: string | null) => {
    if (!link) return null;
    const url = new URL(link, "https://account.invalid");
    const want = url.pathname.match(/^\/wants\/([^/]+)$/);
    const key = want ? `want:${want[1]}` : url.pathname === "/account/offers" ? `offer:${url.hash.slice(1)}` : url.pathname === "/track-order" ? `order:${url.searchParams.get("order")}` : "";
    const image = byKey.get(key);
    return image && (image.startsWith("/") || image.startsWith("https://")) ? image : null;
  };
}

export async function GET() { return api(async () => {
  const c = await customerActor(); const [notifications, unreadRows] = await Promise.all([
    prisma.customerNotification.findMany({ where: { customerId: c.id }, select: { id: true, type: true, title: true, message: true, link: true, isRead: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 150 }),
    prisma.customerNotification.findMany({ where: { customerId: c.id, isRead: false }, select: { type: true, title: true, link: true, isRead: true } }),
  ]);
  const rows = notifications.map(n => ({ ...n, link: safeAccountLink(n.link) }));
  // Thumbnails are decorative; a lookup failure must never hide the notifications themselves.
  const imageFor = await notificationImages(c.id, rows.map(n => n.link)).catch(() => () => null);
  const unreadCounts = notificationUnreadCounts(unreadRows);
  return { unread: unreadCounts.all, unreadCounts, notifications: rows.map(n => ({ ...n, image: imageFor(n.link) })) };
}); }
export async function PATCH(request: Request) { return api(async () => { sameOrigin(request); const c = await customerActor(); await prisma.customerNotification.updateMany({ where: { customerId: c.id, isRead: false }, data: { isRead: true } }); return { ok: true }; }); }
