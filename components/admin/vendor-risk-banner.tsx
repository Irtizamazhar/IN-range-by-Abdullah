"use client";

type Props = {
  riskScore: number;
  riskLevel: "GREEN" | "YELLOW" | "RED";
  suspendRecommended: boolean;
};

function levelColor(level: Props["riskLevel"]) {
  if (level === "GREEN") return "bg-green-500";
  if (level === "YELLOW") return "bg-yellow-500";
  return "bg-red-500";
}

export function VendorRiskBanner({
  riskScore,
  riskLevel,
  suspendRecommended,
}: Props) {
  return (
    <div className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-darkText/70">Risk Score</p>
          <p className="text-3xl font-black text-darkText">{riskScore}/100</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold text-white ${levelColor(riskLevel)}`}
        >
          {riskLevel}
        </span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-lightGray">
        <div
          className={`h-full ${levelColor(riskLevel)}`}
          style={{ width: `${Math.max(0, Math.min(100, riskScore))}%` }}
        />
      </div>
      {suspendRecommended ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          Suspend Recommended
        </p>
      ) : null}
    </div>
  );
}
