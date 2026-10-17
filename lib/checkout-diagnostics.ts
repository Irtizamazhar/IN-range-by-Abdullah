/** Deliberately exclude raw errors, SQL, connection strings and customer payloads. */
export function checkoutDiagnostic(error: unknown, requestId: string, stage: string) {
  const value = error && typeof error === "object" ? error as { code?: unknown; meta?: { column?: unknown; table?: unknown; modelName?: unknown } } : {};
  const safeName = (name: unknown) => typeof name === "string" ? name.replace(/[`"']/g, "").split(".").pop()?.match(/^[A-Za-z0-9_]{1,64}$/)?.[0] : undefined;
  return { event: "checkout_failed", requestId, stage, code: typeof value.code === "string" && /^P\d{4}$/.test(value.code) ? value.code : "UNKNOWN", model: safeName(value.meta?.modelName), column: safeName(value.meta?.column), table: safeName(value.meta?.table) };
}
export function checkoutFailure(error: unknown) {
  const code = checkoutDiagnostic(error, "", "").code;
  return { status: ["P2021", "P2022", "P1001", "P1002", "P1003", "P1008", "P1017", "P2024", "P2028", "P2034"].includes(code) ? 503 : code === "P2002" || code === "P2025" ? 409 : 500,
    error: code === "P2002" ? "An order conflict occurred. Please retry or check My Orders."
      : code === "P2025" ? "A cart item changed. Please refresh your cart and try again."
      : "We could not confirm your order. Your cart is saved. Please retry or contact support." };
}
