export const NOTIFICATIONS_CHANGED = "joro:notifications-changed";
export type NotificationsChanged = { customerId: string; unread: number };
export function announceNotificationsRead(detail: NotificationsChanged) {
  window.dispatchEvent(new CustomEvent<NotificationsChanged>(NOTIFICATIONS_CHANGED, { detail }));
}
