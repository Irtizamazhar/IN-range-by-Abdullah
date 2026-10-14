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

export function calculateCouponFundingReversalCents(params: {
  discountCents: number;
  customerPaidCents: number;
  customerRefundCents: number;
  alreadyReversedCents: number;
}): number {
  const { discountCents, customerPaidCents, customerRefundCents, alreadyReversedCents } = params;
  if (discountCents <= 0 || customerPaidCents <= 0 || customerRefundCents <= 0) return 0;
  return Math.min(
    Math.max(0, discountCents - alreadyReversedCents),
    Math.round(discountCents * customerRefundCents / customerPaidCents)
  );
}

export function grossUpPlatformRefundCents(customerRefundCents: number, lineBaseCents: number, customerPaidCents: number): number {
  return customerPaidCents > 0
    ? Math.round(customerRefundCents * lineBaseCents / customerPaidCents)
    : customerRefundCents;
}
