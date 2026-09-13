export function calculateRefundPaymentStatus(
  processedRefundCents: number,
  orderTotalCents: number
): "partially_refunded" | "refunded" {
  return processedRefundCents >= orderTotalCents
    ? "refunded"
    : "partially_refunded";
}

export function calculateVendorRefundDebitCents(params: {
  customerRefundCents: number;
  lineSaleCents: number;
  lineVendorCents: number;
}): number {
  if (
    params.customerRefundCents <= 0 ||
    params.lineSaleCents <= 0 ||
    params.lineVendorCents <= 0
  ) {
    return 0;
  }
  const boundedRefund = Math.min(params.customerRefundCents, params.lineSaleCents);
  return Math.min(
    params.lineVendorCents,
    Math.round((params.lineVendorCents * boundedRefund) / params.lineSaleCents)
  );
}
