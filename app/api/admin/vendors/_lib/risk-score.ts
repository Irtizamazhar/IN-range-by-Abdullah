import { prisma } from "@/lib/prisma";

export type VendorRiskLevel = "GREEN" | "YELLOW" | "RED";

export type VendorRiskPayload = {
  vendorId: string;
  riskScore: number;
  riskLevel: VendorRiskLevel;
  suspendRecommended: boolean;
  metrics: {
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
  flags: string[];
};

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 10000) / 100;
}

function clamp100(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function calculateVendorRiskScore(
  vendorId: string
): Promise<VendorRiskPayload> {
  const now = Date.now();
  const lateWindowMs = 48 * 60 * 60 * 1000;
  const staleWindowMs = 7 * 24 * 60 * 60 * 1000;

  const [shopOrders, reviews, auditLogs] = await Promise.all([
    prisma.vendorShopOrder.findMany({
      where: { vendorId },
      select: {
        status: true,
        placedAt: true,
        cancelReason: true,
        trackingNumber: true,
      },
    }),
    prisma.vendorReview.findMany({
      where: { vendorId },
      select: { rating: true },
    }),
    prisma.vendorAuditLog.findMany({
      where: { vendorId },
      select: { action: true, details: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalOrders = shopOrders.length;
  const cancelledOrders = shopOrders.filter((o) => o.status === "cancelled").length;
  const lateOrders = shopOrders.filter((o) => {
    const isLateStatus =
      o.status === "pending" || o.status === "confirmed" || o.status === "packed";
    return isLateStatus && now - new Date(o.placedAt).getTime() > lateWindowMs;
  }).length;
  const unfulfilledOrders = shopOrders.filter((o) => {
    const isNotFulfilled = o.status !== "delivered" && o.status !== "shipped";
    return isNotFulfilled && now - new Date(o.placedAt).getTime() > staleWindowMs;
  }).length;

  const returnOrders = shopOrders.filter((o) => {
    const reason = String(o.cancelReason || "").toLowerCase();
    return reason.includes("return") || reason.includes("refund");
  }).length;

  const fakeTrackingCount = auditLogs.filter((l) => {
    const a = l.action.toLowerCase();
    return a.includes("fake_tracking") || a.includes("tracking_flag");
  }).length;

  const totalReviews = reviews.length;
  const reviewSum = reviews.reduce((s, r) => s + Number(r.rating || 0), 0);
  const averageRating = totalReviews
    ? Math.round((reviewSum / totalReviews) * 100) / 100
    : 0;
  const negativeReviewCount = reviews.filter((r) => Number(r.rating) < 3).length;

  const unansweredComplaints = auditLogs.filter((l) => {
    const a = l.action.toLowerCase();
    if (!a.includes("complaint")) return false;
    const details =
      l.details && typeof l.details === "object"
        ? (l.details as Record<string, unknown>)
        : {};
    return details.responded !== true;
  }).length;

  const productViolations = auditLogs.filter((l) => {
    const a = l.action.toLowerCase();
    return (
      a.includes("violation_product") ||
      a.includes("wrong_product") ||
      a.includes("fake_replica") ||
      a.includes("prohibited") ||
      a.includes("copyright")
    );
  }).length;

  const pricingViolations = auditLogs.filter((l) => {
    const a = l.action.toLowerCase();
    return (
      a.includes("violation_pricing") ||
      a.includes("price_manipulation") ||
      a.includes("fake_discount") ||
      a.includes("direct_dealing")
    );
  }).length;

  const policyViolations = auditLogs.filter((l) => {
    const a = l.action.toLowerCase();
    return (
      a.includes("violation_policy") ||
      a.includes("cnic_mismatch") ||
      a.includes("multiple_accounts") ||
      a.includes("review_manipulation")
    );
  }).length;

  const totalViolations = productViolations + pricingViolations + policyViolations;

  const lateShipmentRate = pct(lateOrders, totalOrders);
  const cancellationRate = pct(cancelledOrders, totalOrders);
  const nonFulfillmentRate = pct(unfulfilledOrders, totalOrders);
  const negativeReviewPercent = pct(negativeReviewCount, totalReviews);
  const returnRate = pct(returnOrders, totalOrders);

  const flags: string[] = [];
  let score = 0;

  if (lateShipmentRate > 20) {
    score += 25;
    flags.push(`Late shipment rate high (${lateShipmentRate}%)`);
  }
  if (cancellationRate > 15) {
    score += 20;
    flags.push(`Cancellation rate high (${cancellationRate}%)`);
  }
  if (averageRating > 0 && averageRating < 3) {
    score += 20;
    flags.push(`Average rating low (${averageRating})`);
  }
  if (returnRate > 25) {
    score += 15;
    flags.push(`Return rate high (${returnRate}%)`);
  }
  if (unansweredComplaints > 10) {
    score += 10;
    flags.push(`Unanswered complaints high (${unansweredComplaints})`);
  }

  const violationPoints = Math.min(totalViolations * 5, 30);
  if (violationPoints > 0) {
    score += violationPoints;
    flags.push(`Violations detected (${totalViolations})`);
  }

  const riskScore = clamp100(score);
  const riskLevel: VendorRiskLevel =
    riskScore <= 30 ? "GREEN" : riskScore <= 60 ? "YELLOW" : "RED";

  return {
    vendorId,
    riskScore,
    riskLevel,
    suspendRecommended: riskLevel === "RED",
    metrics: {
      orderPerformance: {
        lateShipmentRate,
        cancellationRate,
        nonFulfillmentRate,
        fakeTrackingCount,
      },
      customerSatisfaction: {
        averageRating,
        negativeReviewPercent,
        returnRate,
        unansweredComplaints,
      },
      violations: {
        productViolations,
        pricingViolations,
        policyViolations,
        totalViolations,
      },
    },
    flags,
  };
}
