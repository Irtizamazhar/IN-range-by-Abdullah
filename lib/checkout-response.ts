export type CheckoutReceipt = { _id: string; orderNumber: string; customerPhone: string; totalAmount?: number; handlingFee?: number; addressSaveWarning?: string };

/** A successful HTTP status alone is not confirmation that an order exists. */
export async function readCheckoutReceipt(response: Response): Promise<CheckoutReceipt> {
  const value: unknown = await response.json().catch(() => null);
  const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (!response.ok) {
    const reference = response.headers.get("X-Request-ID");
    const suffix = reference && /^[a-zA-Z0-9-]{1,64}$/.test(reference) ? ` Reference: ${reference}.` : "";
    const message = response.status === 401 ? "Your session has expired. Please sign in again. Your cart is saved."
      : response.status === 403 ? "Checkout access is unavailable. Please sign in again or contact support."
      : response.status === 402 ? "Payment could not be confirmed. Please review your payment method."
      : response.status < 500 && typeof data.error === "string" && data.error.length <= 300 ? data.error
      : "We could not confirm your order. Your cart is saved. Please retry or contact support.";
    throw new Error(message + suffix);
  }
  if (typeof data._id !== "string" || !data._id.trim() || typeof data.orderNumber !== "string" || !data.orderNumber.trim()) {
    throw new Error("We could not confirm your order. Your cart is saved. Please retry or check My Orders.");
  }
  return {
    _id: data._id,
    orderNumber: data.orderNumber,
    customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
    totalAmount: typeof data.totalAmount === "number" && Number.isFinite(data.totalAmount) ? data.totalAmount : undefined,
    handlingFee: typeof data.handlingFee === "number" && Number.isFinite(data.handlingFee) ? data.handlingFee : undefined,
  };
}

const STORAGE_KEY = "joro:checkout-attempt";
export function checkoutAttemptKey(signature: string, storage?: Pick<Storage, "getItem" | "setItem">, makeKey = () => crypto.randomUUID()): string {
  try {
    const prior = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    if (prior?.signature === signature && typeof prior.key === "string" && /^[A-Za-z0-9:_-]{16,128}$/.test(prior.key)) return prior.key;
  } catch { /* Storage may be disabled. The caller also retains an in-memory key. */ }
  const key = makeKey();
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ signature, key })); } catch { /* Keep the in-memory key. */ }
  return key;
}
export function clearCheckoutAttempt(storage?: Pick<Storage, "removeItem">) {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* Checkout is already confirmed. */ }
}
