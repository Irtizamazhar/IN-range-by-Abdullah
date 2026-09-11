"use client";

type Metrics = {
  orderPerformance: {
    lateShipmentRate: number;
    cancellationRate: number;
    nonFulfillmentRate: number;
    fakeTrackingCount: number;
  };
  customerSatisfaction: {
    averageRating: number;
    negativeReviewPercent: number;
    returnRate: number;
    unansweredComplaints: number;
  };
  violations: {
    productViolations: number;
    pricingViolations: number;
    policyViolations: number;
    totalViolations: number;
  };
};

function colorByThreshold(v: number, warn: number, high: number) {
  if (v >= high) return "text-red-600";
  if (v >= warn) return "text-yellow-600";
  return "text-green-600";
}

export function VendorMetricsGrid({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-borderGray bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-darkText">Order Performance</p>
        <p className={`mt-2 text-sm ${colorByThreshold(metrics.orderPerformance.lateShipmentRate, 10, 20)}`}>
          Late Shipment: {metrics.orderPerformance.lateShipmentRate}%
        </p>
        <p className={`text-sm ${colorByThreshold(metrics.orderPerformance.cancellationRate, 8, 15)}`}>
          Cancellation: {metrics.orderPerformance.cancellationRate}%
        </p>
        <p className={`text-sm ${colorByThreshold(metrics.orderPerformance.nonFulfillmentRate, 10, 20)}`}>
          Non-fulfillment: {metrics.orderPerformance.nonFulfillmentRate}%
        </p>
      </div>

      <div className="rounded-xl border border-borderGray bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-darkText">Customer Satisfaction</p>
        <p className="mt-2 text-sm text-darkText">
          Avg Rating: {metrics.customerSatisfaction.averageRating}
        </p>
        <p className="text-sm text-darkText">
          Negative Reviews: {metrics.customerSatisfaction.negativeReviewPercent}%
        </p>
        <p className="text-sm text-darkText">
          Return Rate: {metrics.customerSatisfaction.returnRate}%
        </p>
      </div>

      <div className="rounded-xl border border-borderGray bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-darkText">Complaints</p>
        <p
          className={`mt-2 text-2xl font-black ${
            metrics.customerSatisfaction.unansweredComplaints >= 10
              ? "text-red-600"
              : metrics.customerSatisfaction.unansweredComplaints >= 3
                ? "text-yellow-600"
                : "text-green-600"
          }`}
        >
          {metrics.customerSatisfaction.unansweredComplaints}
        </p>
        <p className="text-xs text-darkText/60">Unanswered complaints</p>
      </div>

      <div className="rounded-xl border border-borderGray bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-darkText">Violations</p>
        <p className="mt-2 text-sm text-darkText">
          Product: {metrics.violations.productViolations}
        </p>
        <p className="text-sm text-darkText">
          Pricing: {metrics.violations.pricingViolations}
        </p>
        <p className="text-sm text-darkText">
          Policy: {metrics.violations.policyViolations}
        </p>
      </div>
    </div>
  );
}
