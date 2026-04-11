"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Cat = {
  id: string;
  categoryName: string;
  commissionPercentage: number;
};

type VendorRow = {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  primaryCategory: string;
  specialCommissionRate: number | null;
};

export function CommissionClient() {
  const [categories, setCategories] = useState<Cat[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [vEdits, setVEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, v] = await Promise.all([
        fetch("/api/admin/commission-settings", { credentials: "same-origin" }),
        fetch("/api/admin/vendors?status=approved", {
          credentials: "same-origin",
        }),
      ]);
      if (c.ok) {
        const d = (await c.json()) as { categories: Cat[] };
        setCategories(d.categories || []);
        const e: Record<string, string> = {};
        for (const x of d.categories || []) {
          e[x.id] = String(x.commissionPercentage);
        }
        setEdits(e);
      }
      if (v.ok) {
        const d = (await v.json()) as { vendors: VendorRow[] };
        setVendors(d.vendors || []);
        const ve: Record<string, string> = {};
        for (const x of d.vendors || []) {
          ve[x.id] =
            x.specialCommissionRate != null
              ? String(x.specialCommissionRate)
              : "";
        }
        setVEdits(ve);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCategory(id: string) {
    const raw = edits[id];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("Rate must be 0–100");
      return;
    }
    setBusy(id);
    try {
      const r = await fetch("/api/admin/commission-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, commissionPercentage: n }),
      });
      if (!r.ok) {
        toast.error("Update failed");
        return;
      }
      toast.success("Commission updated");
      void load();
    } finally {
      setBusy(null);
    }
  }

  async function saveVendorCommission(vendorId: string) {
    const raw = vEdits[vendorId]?.trim();
    const body =
      raw === ""
        ? { action: "set_commission" as const, specialCommissionRate: null }
        : {
            action: "set_commission" as const,
            specialCommissionRate: Number(raw),
          };
    if (raw !== "" && (!Number.isFinite(body.specialCommissionRate as number) || (body.specialCommissionRate as number) < 0 || (body.specialCommissionRate as number) > 100)) {
      toast.error("Override must be 0–100 or empty for default");
      return;
    }
    setBusy(`v-${vendorId}`);
    try {
      const r = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        toast.error("Update failed");
        return;
      }
      toast.success("Vendor commission saved");
      void load();
    } finally {
      setBusy(null);
    }
  }

  if (loading && categories.length === 0) {
    return <div className="p-8 text-darkText/50">Loading…</div>;
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-darkText">Commission settings</h1>
      <p className="mt-1 text-sm text-darkText/60">
        Category defaults apply to new orders. Vendor override wins over category
        and global.
      </p>

      <h2 className="mt-10 text-lg font-bold text-darkText">By category</h2>
      <div className="mt-4 overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-borderGray bg-lightGray">
            <tr>
              <th className="p-3">Category</th>
              <th className="p-3">Rate %</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr
                key={c.id}
                className="border-b border-borderGray hover:bg-lightGray/40"
              >
                <td className="p-3 font-medium">{c.categoryName}</td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={edits[c.id] ?? ""}
                    onChange={(e) =>
                      setEdits((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    className="w-28 rounded-lg border border-borderGray px-2 py-1"
                  />
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => void saveCategory(c.id)}
                    className="rounded-lg bg-primaryYellow px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-lg font-bold text-darkText">
        Vendor overrides
      </h2>
      <p className="mt-1 text-sm text-darkText/60">
        Leave blank to use category / global rules. 0–100%.
      </p>
      <div className="mt-4 overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-borderGray bg-lightGray">
            <tr>
              <th className="p-3">Shop</th>
              <th className="p-3">Primary category</th>
              <th className="p-3">Override %</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-darkText/50">
                  No approved vendors.
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-borderGray hover:bg-lightGray/40"
                >
                  <td className="p-3">
                    <div className="font-semibold">{v.shopName}</div>
                    <div className="text-xs text-darkText/60">{v.email}</div>
                  </td>
                  <td className="p-3">{v.primaryCategory}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="—"
                      value={vEdits[v.id] ?? ""}
                      onChange={(e) =>
                        setVEdits((prev) => ({
                          ...prev,
                          [v.id]: e.target.value,
                        }))
                      }
                      className="w-28 rounded-lg border border-borderGray px-2 py-1"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={busy === `v-${v.id}`}
                      onClick={() => void saveVendorCommission(v.id)}
                      className="rounded-lg bg-primaryBlue px-4 py-1.5 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
