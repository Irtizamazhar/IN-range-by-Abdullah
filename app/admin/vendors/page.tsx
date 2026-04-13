"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type VendorStatus = "pending" | "approved" | "rejected" | "suspended";

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
  cnic: string;
  address: string;
  businessType: string;
  businessRegNo: string | null;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
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

const STATUS_OPTIONS: { value: "" | VendorStatus; label: string }[] = [
  { value: "", label: "All" },
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
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<AdminVendorRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const r = await fetch(`/api/admin/vendors${q}`, {
        credentials: "same-origin",
      });
      const data = (await r.json()) as {
        vendors?: AdminVendorRow[];
        error?: string;
      };
      if (!r.ok) {
        toast.error(data.error || "Could not load vendors");
        setRows([]);
        return;
      }
      setRows(data.vendors || []);
    } catch {
      toast.error("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

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
            Approve or reject pending sellers anytime. They must verify email
            before they can log in, even if already approved. Rejected vendors
            see your reason on login.
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
              setFilter(e.target.value as "" | VendorStatus)
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
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                        className="rounded-lg bg-primaryBlue px-3 py-2 text-sm font-bold text-white hover:bg-darkBlue disabled:opacity-50"
                      >
                        Approve again
                      </button>
                    ) : null}
                  </div>
                </div>

                {v.status === "pending" && !v.isEmailVerified ? (
                  <div className="px-4 pb-4 text-sm text-amber-800 bg-amber-50/80 border-t border-amber-100">
                    Email not verified yet — you can still use{" "}
                    <strong>Approve</strong> or <strong>Reject</strong>. After
                    approval, the seller must verify their email (link in inbox
                    or resend) before they can sign in.
                  </div>
                ) : null}

                {open ? (
                  <div className="border-t border-borderGray bg-[#F8F9FA] p-4 space-y-4 text-sm">
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
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={d.fileUrl}
                                  alt={d.documentType}
                                  className="h-36 w-auto max-w-[200px] rounded-lg border border-borderGray object-cover bg-white"
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
