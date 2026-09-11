"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { VendorFlagsList } from "@/components/admin/vendor-flags-list";
import { VendorMetricsGrid } from "@/components/admin/vendor-metrics-grid";
import { VendorRiskBanner } from "@/components/admin/vendor-risk-banner";
import { VendorSuspendModal } from "@/components/admin/vendor-suspend-modal";

type RiskResponse = {
  vendorId: string;
  riskScore: number;
  riskLevel: "GREEN" | "YELLOW" | "RED";
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

type VendorDataResponse = {
  vendor: {
    id: string;
    ownerName: string;
    shopName: string;
    email: string;
    status: "pending" | "approved" | "rejected" | "suspended";
    createdAt: string;
    suspensionCount: number;
    suspendedAt: string | null;
    suspensionReason: string | null;
    suspendedBy: string | null;
    suspensionUntil: string | null;
  };
  logs: Array<{
    id: string;
    action: string;
    details: unknown;
    createdAt: string;
  }>;
  appeals: Array<{
    id: string;
    createdAt: string;
    details: unknown;
  }>;
};

function statusBadge(status: string) {
  if (status === "approved") return "bg-green-100 text-green-700";
  if (status === "suspended") return "bg-red-100 text-red-700";
  if (status === "rejected") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminVendorSuspensionPage() {
  const params = useParams();
  const id = String((params?.id as string | undefined) ?? "");

  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [data, setData] = useState<VendorDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [riskRes, dataRes] = await Promise.all([
        fetch(`/api/admin/vendors/${encodeURIComponent(id)}/risk-score`),
        fetch(`/api/admin/vendors/${encodeURIComponent(id)}/suspension`),
      ]);
      const riskJson = (await riskRes.json()) as RiskResponse & { error?: string };
      const dataJson = (await dataRes.json()) as VendorDataResponse & {
        error?: string;
      };
      if (!riskRes.ok) throw new Error(riskJson.error || "Risk API failed");
      if (!dataRes.ok) throw new Error(dataJson.error || "Vendor API failed");
      setRisk(riskJson);
      setData(dataJson);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load page");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeAppeals = useMemo(
    () =>
      (data?.appeals || []).filter((a) => {
        const details =
          a.details && typeof a.details === "object"
            ? (a.details as Record<string, unknown>)
            : {};
        return details.resolved !== true;
      }),
    [data]
  );

  if (loading || !risk || !data) {
    return <div className="mx-auto max-w-7xl p-6 md:p-8">Loading…</div>;
  }

  const v = data.vendor;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/vendors"
            className="text-sm font-semibold text-primaryBlue hover:underline"
          >
            ← Back to vendors
          </Link>
          <h1 className="mt-2 text-2xl font-black text-darkText">
            Vendor Suspension Profile
          </h1>
        </div>
      </div>

      <section className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-darkText">{v.shopName}</h2>
            <p className="text-darkText/80">{v.ownerName}</p>
            <p className="text-sm text-darkText/70">{v.email}</p>
            <p className="mt-1 text-xs text-darkText/60">
              Joined: {fmtDate(v.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusBadge(v.status)}`}
            >
              {v.status}
            </span>
            <p className="mt-2 text-sm text-darkText">
              Suspension Count: <strong>{v.suspensionCount}</strong>
            </p>
            <p className="text-sm text-darkText/70">
              Last Suspended: {fmtDate(v.suspendedAt)}
            </p>
          </div>
        </div>
      </section>

      <VendorRiskBanner
        riskScore={risk.riskScore}
        riskLevel={risk.riskLevel}
        suspendRecommended={risk.suspendRecommended}
      />

      <VendorMetricsGrid metrics={risk.metrics} />

      <VendorFlagsList flags={risk.flags} />

      <section className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
        <h3 className="mb-3 text-lg font-black text-darkText">Violation & Activity Log</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-lightGray text-left">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Done By</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((l) => {
                const details =
                  l.details && typeof l.details === "object"
                    ? (l.details as Record<string, unknown>)
                    : {};
                return (
                  <tr key={l.id} className="border-b border-borderGray">
                    <td className="px-3 py-2">{fmtDate(l.createdAt)}</td>
                    <td className="px-3 py-2 font-semibold">{l.action}</td>
                    <td className="px-3 py-2">
                      {String(details.message || details.reason || "—")}
                    </td>
                    <td className="px-3 py-2">
                      {String(details.adminEmail || details.resolvedBy || "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {v.suspensionCount > 0 ? (
        <section className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
          <h3 className="text-lg font-black text-darkText">Previous Suspensions</h3>
          <p className="mt-2 text-sm text-darkText">
            Last suspended date: <strong>{fmtDate(v.suspendedAt)}</strong>
          </p>
          <p className="text-sm text-darkText">
            Last reason: <strong>{v.suspensionReason || "—"}</strong>
          </p>
          <p className="text-sm text-darkText">
            Suspended by: <strong>{v.suspendedBy || "—"}</strong>
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
        <h3 className="text-lg font-black text-darkText">Suspend / Unsuspend</h3>
        {v.status !== "suspended" ? (
          <button
            type="button"
            onClick={() => setSuspendOpen(true)}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
          >
            Suspend Vendor
          </button>
        ) : (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              Suspended: {v.suspensionReason || "No reason"}
            </p>
            <p className="text-xs text-red-700/80">At: {fmtDate(v.suspendedAt)}</p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch(
                    `/api/admin/vendors/${encodeURIComponent(id)}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "unsuspend" }),
                    }
                  );
                  if (!r.ok) throw new Error("Unsuspend failed");
                  toast.success("Vendor unsuspended");
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Unsuspend failed");
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Unsuspend Vendor
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
        <h3 className="text-lg font-black text-darkText">Active Appeals</h3>
        {activeAppeals.length === 0 ? (
          <p className="mt-2 text-sm text-darkText/60">No pending appeals.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {activeAppeals.map((a) => {
              const details =
                a.details && typeof a.details === "object"
                  ? (a.details as Record<string, unknown>)
                  : {};
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <p className="text-xs text-amber-800/80">{fmtDate(a.createdAt)}</p>
                  <p className="text-sm text-amber-900">
                    {String(details.message || "No message")}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch(
                        `/api/admin/vendors/${encodeURIComponent(id)}/appeals/${encodeURIComponent(a.id)}/resolve`,
                        { method: "PATCH" }
                      );
                      if (!r.ok) {
                        toast.error("Could not resolve appeal");
                        return;
                      }
                      toast.success("Appeal marked resolved");
                      await load();
                    }}
                    className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                  >
                    Mark resolved
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <VendorSuspendModal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={async (payload) => {
          const r = await fetch(`/api/admin/vendors/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "suspend", ...payload }),
          });
          if (!r.ok) throw new Error("Suspend failed");
          toast.success("Vendor suspended");
          setSuspendOpen(false);
          await load();
        }}
      />
    </div>
  );
}
