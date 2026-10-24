/**
 * Presentation rules for customer notifications. Notifications only persist `type`, `title` and `link`,
 * so the category, icon and contextual action are derived from those fields here — never invented.
 */
export type NotificationCategory = "wants" | "offers" | "orders" | "messages" | "system";
export type NotificationVisual =
  | "want-live" | "want-rejected" | "want-update"
  | "offer" | "offer-withdrawn"
  | "order" | "order-shipped" | "order-delivered" | "order-cancelled" | "seller-delivery" | "payment"
  | "return" | "refund" | "dispute"
  | "message" | "welcome" | "system";

export type NotificationLike = { type: string; title: string; link: string | null };

export type NotificationUnreadCounts = Record<"all" | NotificationCategory, number>;
export function notificationUnreadCounts(rows: readonly (NotificationLike & { isRead: boolean })[]): NotificationUnreadCounts {
  const counts: NotificationUnreadCounts = { all: 0, wants: 0, offers: 0, orders: 0, messages: 0, system: 0 };
  for (const row of rows) {
    if (row.isRead) continue;
    counts.all++;
    counts[notificationCategory(row)]++;
  }
  return counts;
}

const ORDER_TYPES = new Set(["order_status", "payment_status", "seller_delivery_status", "order_cancelled", "seller_order_cancelled", "return_update", "refund_pending", "refund_processed", "dispute_update"]);

const isOfferLink = (link: string | null) => !!link && link.startsWith("/account/offers");
const isTicketLink = (link: string | null) => !!link && link.startsWith("/account/help/tickets/");

export function notificationCategory(n: NotificationLike): NotificationCategory {
  if (n.type === "want_moderation") return "wants";
  if (ORDER_TYPES.has(n.type)) return "orders";
  if (isOfferLink(n.link)) return "offers";
  if (isTicketLink(n.link)) return "messages";
  return "system";
}

export function notificationVisual(n: NotificationLike): NotificationVisual {
  const title = n.title.toLowerCase();
  switch (n.type) {
    case "want_moderation": return title.includes("live") ? "want-live" : /rejected|removed|blocked/.test(title) ? "want-rejected" : "want-update";
    case "order_status": return title.includes("cancel") ? "order-cancelled" : title.includes("deliver") ? "order-delivered" : title.includes("ship") ? "order-shipped" : "order";
    case "seller_delivery_status": return title.includes("cancel") ? "order-cancelled" : title.includes("deliver") ? "order-delivered" : "seller-delivery";
    case "order_cancelled": case "seller_order_cancelled": return "order-cancelled";
    case "payment_status": return "payment";
    case "return_update": return "return";
    case "refund_pending": case "refund_processed": return "refund";
    case "dispute_update": return "dispute";
    case "WELCOME_ONBOARDING": return "welcome";
  }
  if (isOfferLink(n.link)) return title.includes("withdrew") ? "offer-withdrawn" : "offer";
  if (isTicketLink(n.link)) return "message";
  return "system";
}

/** Label for the notification's own link; null when there is no safe destination to offer. */
export function notificationActionLabel(n: NotificationLike): string | null {
  const link = n.link;
  if (!link) return null;
  if (link.startsWith("/wants/")) return "View Want";
  if (isOfferLink(link)) return "View Offer";
  if (link.startsWith("/track-order")) return "Track Order";
  if (isTicketLink(link)) return "View Ticket";
  if (link.startsWith("/my-stuff")) return "View in My Stuff";
  if (link === "/") return "Start Shopping";
  return "View Details";
}

export function notificationSearchText(n: NotificationLike & { message: string }): string {
  return `${n.title} ${n.message} ${notificationCategory(n)} ${n.type.replaceAll("_", " ")}`.toLowerCase();
}
