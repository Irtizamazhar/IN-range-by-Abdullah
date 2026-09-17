"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import toast from "react-hot-toast";

type VendorStatus = "onboarding" | "pending" | "approved" | "rejected" | "suspended";

type VendorDoc = {
  id: string;
  documentType: string;
  fileUrl: string;
};

type AdminVendorRow = {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  cnic: string | null;
  address: string;
  businessType: string;
  businessRegNo: string | null;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string | null;
  storeSlug: string | null;
  onboardingData: Record<string, string | boolean | number> | null;
  primaryCategory: string;
  shopDescription: string | null;
  status: VendorStatus;
  isEmailVerified: boolean;
  rejectionReason: string | null;
  latestAppeal: {
    id: string;
    createdAt: string;
    message: string | null;
  } | null;
  createdAt: string;
  documents: VendorDoc[];
};

type RiskMini = { riskLevel: "GREEN" | "YELLOW" | "RED"; riskScore: number };

const STATUS_OPTIONS: { value: "" | VendorStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "onboarding", label: "Setup incomplete" },
  { value: "pending", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

function badgeClass(s: VendorStatus) {
  switch (s) {
    case "pending":
      return "bg-amber-100 text-amber-900";
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "suspended":
      return "bg-neutral-200 text-neutral-800";
    default:
      return "bg-neutral-100 text-neutral-800";
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminVendorsPage() {
  const [filter, setFilter] = useState<"" | VendorStatus>("pending");
  const [rows, setRows] = useState<AdminVendorRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<AdminVendorRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [riskByVendor, setRiskByVendor] = useState<Record<string, RiskMini>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = `?page=${page}${filter ? `&status=${encodeURIComponent(filter)}` : ""}`;
      const r = await fetch(`/api/admin/vendors${q}`, {
        credentials: "same-origin",
      });
      const data = (await r.json()) as {
        vendors?: AdminVendorRow[];
        total?: number;
        error?: string;
      };
      if (!r.ok) {
        toast.error(data.error || "Could not load vendors");
        setRows([]);
        return;
      }
      setRows(data.vendors || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!rows.length) {
        setRiskByVendor({});
        return;
      }
      const entries = await Promise.all(
        rows.filter(r => r.id === expanded).map(async (r) => {
          try {
            const res = await fetch(
              `/api/admin/vendors/${encodeURIComponent(r.id)}/risk-score`
            );
            const json = (await res.json()) as
              | { riskLevel: "GREEN" | "YELLOW" | "RED"; riskScore: number }
              | { error?: string };
            if (!res.ok || !("riskLevel" in json)) return [r.id, null] as const;
            return [r.id, json] as const;
          } catch {
            return [r.id, null] as const;
          }
        })
      );
      if (cancelled) return;
      const next: Record<string, RiskMini> = {};
      for (const [id, risk] of entries) {
        if (risk) next[id] = risk;
      }
      setRiskByVendor(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, expanded]);

  async function patch(
    id: string,
    body: { action: "approve" | "reject" | "suspend"; rejectionReason?: string }
  ) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/vendors/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error || "Update failed");
        return;
      }
      toast.success("Updated");
      setRejectFor(null);
      setRejectReason("");
      await load();
    } catch {
      toast.error("Network error");
    } finally {
      setBusyId(null);
    }
  }

  function submitReject() {
    if (!rejectFor) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error("Please enter a rejection reason (at least 3 characters).");
      return;
    }
    void patch(rejectFor.id, { action: "reject", rejectionReason: reason });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-darkText">Vendors</h1>
          <p className="text-sm text-darkText/70 mt-1">
            Approve or reject pending sellers anytime. Approving also marks email
            verified so they can sign in immediately. Rejected vendors see your
            reason on login.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="vf" className="text-sm font-semibold text-darkText">
            Filter
          </label>
          <select
            id="vf"
            value={filter}
            onChange={(e) =>
              (setFilter(e.target.value as "" | VendorStatus), setPage(1))
            }
            className="rounded-lg border border-borderGray px-3 py-2 text-sm font-medium"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-darkText/60">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-borderGray bg-white p-8 text-center text-darkText/70">
          No vendors in this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((v) => {
            const open = expanded === v.id;
            return (
              <div
                key={v.id}
                className="rounded-xl border border-borderGray bg-white shadow-sm overflow-hidden"
              >
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-darkText text-lg">
                        {v.shopName}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${badgeClass(v.status)}`}
                      >
                        {v.status}
                      </span>
                      {!v.isEmailVerified ? (
                        <span className="text-xs font-semibold text-amber-700">
                          Email not verified
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-darkText/80 mt-1">
                      {v.ownerName} · {v.email} · {v.phone}
                    </p>
                    <p className="text-xs text-darkText/50 mt-1">
                      Applied {formatDate(v.createdAt)} · {v.city} ·{" "}
                      {v.primaryCategory}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-darkText/70">
                        Risk:
                      </span>
                      {riskByVendor[v.id] ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            riskByVendor[v.id].riskLevel === "GREEN"
                              ? "bg-green-100 text-green-700"
                              : riskByVendor[v.id].riskLevel === "YELLOW"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {riskByVendor[v.id].riskLevel} ({riskByVendor[v.id].riskScore})
                        </span>
                      ) : (
                        <span className="text-xs text-darkText/50">—</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/admin/vendors/${encodeURIComponent(v.id)}/suspension`}
                      className="rounded-lg border border-primaryBlue px-3 py-2 text-sm font-semibold text-primaryBlue hover:bg-primaryBlue/10"
                    >
                      View Risk Profile
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(open ? null : v.id)
                      }
                      className="rounded-lg border border-borderGray px-3 py-2 text-sm font-semibold hover:bg-lightGray/40"
                    >
                      {open ? "Hide details" : "Details & documents"}
                    </button>
                    {v.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === v.id}
                          onClick={() =>
                            void patch(v.id, { action: "approve" })
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === v.id}
                          onClick={() => {
                            setRejectFor(v);
                            setRejectReason("");
                          }}
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {v.status === "approved" ? (
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() =>
                          void patch(v.id, { action: "suspend" })
                        }
                        className="rounded-lg border border-amber-600 px-3 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    ) : null}
                    {(v.status === "rejected" || v.status === "suspended") ? (
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() =>
                          void patch(v.id, { action: "approve" })
                        }
                        className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-bold text-brand-dark hover:bg-brand-hover disabled:opacity-50"
                      >
                        Approve again
                      </button>
                    ) : null}
                  </div>
                </div>

                {v.status === "pending" && !v.isEmailVerified ? (
                  <div className="px-4 pb-4 text-sm text-amber-800 bg-amber-50/80 border-t border-amber-100">
                    Email not verified yet — you can still use{" "}
                    <strong>Approve</strong> or <strong>Reject</strong>. Approval also marks this account verified and grants dashboard access.
                  </div>
                ) : null}

                {open ? (
                  <div className="border-t border-borderGray bg-brand-background p-4 space-y-4 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="font-bold text-darkText">Address</p>
                        <p className="text-darkText/80">{v.address}</p>
                      </div>
                      <div>
                        <p className="font-bold text-darkText">CNIC</p>
                        <p className="text-darkText/80">{v.cnic}</p>
                      </div>
                      <div>
                        <p className="font-bold text-darkText">Business</p>
                        <p className="text-darkText/80">
                          {v.businessType}
                          {v.businessRegNo
                            ? ` · Reg: ${v.businessRegNo}`
                            : ""}
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-darkText">Bank</p>
                        <p className="text-darkText/80">
                          {v.bankName} — {v.accountTitle} — {v.accountNumber}
                        </p>
                      </div>
                    </div>
                    <section className="rounded-xl border bg-white p-4">
                      <h3 className="font-bold">Private operational details</h3>
                      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                        {Object.entries({ "Store slug": v.storeSlug, IBAN: v.iban,
                          "Registered business name": v.onboardingData?.businessLegalName,
                          "NTN (optional)": v.onboardingData?.taxNumber,
                          "Business province": v.onboardingData?.province,
                          "Business postal code": v.onboardingData?.postalCode,
                          "Pickup address": v.onboardingData?.pickupAddress,
                          "Pickup city": v.onboardingData?.pickupCity,
                          "Pickup province": v.onboardingData?.pickupProvince,
                          "Pickup postal code": v.onboardingData?.pickupPostalCode,
                          "Pickup contact": v.onboardingData?.pickupContactName,
                          "Pickup phone": v.onboardingData?.pickupPhone,
                          "Return address": v.onboardingData?.returnSameAsPickup ? "Same as pickup" : v.onboardingData?.returnAddress,
                          "Return city": v.onboardingData?.returnSameAsPickup ? v.onboardingData?.pickupCity : v.onboardingData?.returnCity,
                          "Return province": v.onboardingData?.returnSameAsPickup ? v.onboardingData?.pickupProvince : v.onboardingData?.returnProvince,
                          "Return postal code": v.onboardingData?.returnSameAsPickup ? v.onboardingData?.pickupPostalCode : v.onboardingData?.returnPostalCode,
                          "Return contact": v.onboardingData?.returnSameAsPickup ? v.onboardingData?.pickupContactName : v.onboardingData?.returnContactName,
                          "Return phone": v.onboardingData?.returnSameAsPickup ? v.onboardingData?.pickupPhone : v.onboardingData?.returnPhone,
                        }).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-neutral-500">{label}</dt><dd className="break-words">{String(value || "Not provided")}</dd></div>)}
                      </dl>
                    </section>
                    {v.shopDescription ? (
                      <div>
                        <p className="font-bold text-darkText">Shop note</p>
                        <p className="text-darkText/80 whitespace-pre-wrap">
                          {v.shopDescription}
                        </p>
                      </div>
                    ) : null}
                    {v.rejectionReason ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="font-bold text-red-900">Last rejection</p>
                        <p className="text-red-800">{v.rejectionReason}</p>
                      </div>
                    ) : null}
                    {v.latestAppeal ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="font-bold text-amber-900">Latest appeal</p>
                        <p className="text-xs text-amber-800/80">
                          {formatDate(v.latestAppeal.createdAt)}
                        </p>
                        <p className="mt-1 text-amber-900">
                          {v.latestAppeal.message?.trim() || "No message provided."}
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <p className="font-bold text-darkText mb-2">Documents</p>
                      <div className="flex flex-wrap gap-4">
                        {v.documents.length === 0 ? (
                          <span className="text-darkText/50">No files</span>
                        ) : (
                          v.documents.map((d) => (
                            <div key={d.id} className="text-center">
                              <a
                                href={d.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Image
                                  src={d.fileUrl}
                                  alt={d.documentType}
                                  width={200}
                                  height={144}
                                  className="h-36 w-auto max-w-[200px] rounded-lg border border-borderGray object-cover bg-white"
                                  unoptimized={shouldUnoptimizeImageSrc(d.fileUrl)}
                                />
                              </a>
                              <span className="text-xs font-semibold text-darkText/70 capitalize">
                                {d.documentType.replace(/_/g, " ")}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <nav aria-label="Vendor pages" className="my-6 flex flex-wrap items-center gap-3 text-sm">
        <button disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Previous</button>
        <span>Page {page} of {Math.max(1, Math.ceil(total / 20))} · {total} vendors</span>
        <button disabled={loading || page * 20 >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Next</button>
      </nav>
      {rejectFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-black text-darkText">
              Reject {rejectFor.shopName}
            </h2>
            <p className="text-sm text-darkText/70 mt-1">
              This message is shown to the vendor when they try to sign in.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-borderGray p-3 text-sm"
              placeholder="Reason for rejection…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectFor(null);
                  setRejectReason("");
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold border border-borderGray"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === rejectFor.id}
                onClick={() => submitReject()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Reject vendor
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
