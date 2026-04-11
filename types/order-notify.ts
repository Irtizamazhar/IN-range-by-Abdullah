/** Fields needed for order notification emails */
export interface OrderNotifyPayload {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number | string;
  trackingNumber?: string | null;
  /** Seller slice id (e.g. IRV-0001) for multi-vendor emails */
  shopOrderNumber?: string | null;
}
