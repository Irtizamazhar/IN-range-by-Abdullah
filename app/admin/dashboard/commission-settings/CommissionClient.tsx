"use client";
import { blockNonDigitKeys, wholeNumber } from "@/lib/whole-number-input";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Box, Gift, Info, Settings, Truck } from "lucide-react";
import type { ISettings } from "@/types/settings";
import { ServiceCommissionRanges } from "./ServiceCommissionRanges";

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

type TabKey = "products" | "services" | "gifts" | "delivery";

const TABS: { key: TabKey; label: string; icon: typeof Box }[] = [
  { key: "products", label: "Products", icon: Box },
  { key: "services", label: "Services", icon: Settings },
  { key: "gifts", label: "Gifts", icon: Gift },
  { key: "delivery", label: "Delivery", icon: Truck },
];

const inputClass =
  "w-28 rounded-lg border border-borderGray px-2 py-1 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const saveButtonClass =
  "rounded-lg bg-primaryYellow px-4 py-1.5 text-xs font-semibold text-brand-dark";

function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-primary/40 bg-brand-soft/50 px-4 py-3 text-sm text-darkText/80">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark/70" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-card border border-dashed border-borderGray bg-white p-6 text-center shadow-card">
      <p className="font-semibold text-darkText">{title}</p>
      <div className="mt-1 text-sm text-darkText/60">{children}</div>
    </div>
  );
}

export function CommissionClient() {
  const [tab, setTab] = useState<TabKey>("products");
  const [categories, setCategories] = useState<Cat[]>([]);
  const [giftCategoryIds, setGiftCategoryIds] = useState<string[]>([]);
  const [giftTerms, setGiftTerms] = useState<string[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [vEdits, setVEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [siteSettings, setSiteSettings] = useState<ISettings | null>(null);
  const [deliveryFeeEdit, setDeliveryFeeEdit] = useState("");
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [c, v] = await Promise.all([
        fetch("/api/admin/commission-settings", { credentials: "same-origin" }),
        fetch("/api/admin/vendors?status=approved", {
          credentials: "same-origin",
        }),
      ]);
      if (!c.ok || !v.ok) throw new Error("Could not load commission settings");
      if (c.ok) {
        const d = (await c.json()) as {
          categories: Cat[];
          giftCategoryIds?: string[];
          giftTerms?: string[];
        };
        setCategories(d.categories || []);
        const e: Record<string, string> = {};
        for (const x of d.categories || []) {
          e[x.id] = String(x.commissionPercentage);
        }
        setEdits(e);
        setGiftCategoryIds(d.giftCategoryIds || []);
        setGiftTerms(d.giftTerms || []);
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDelivery = useCallback(async () => {
    setDeliveryLoading(true);
    setDeliveryError(null);
    try {
      const r = await fetch("/api/settings", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Could not load delivery settings");
      const d = (await r.json()) as ISettings;
      setSiteSettings(d);
      setDeliveryFeeEdit(String(d.codCharges ?? 0));
    } catch (error) {
      setDeliveryError(
        error instanceof Error ? error.message : "Could not load delivery settings"
      );
    } finally {
      setDeliveryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "delivery" && !siteSettings && !deliveryLoading && !deliveryError) {
      void loadDelivery();
    }
  }, [tab, siteSettings, deliveryLoading, deliveryError, loadDelivery]);

  async function saveCategory(id: string) {
    const raw = edits[id];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("Rate must be 0–100");
      return;
    }

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
      await load(false);

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
      await load(false);

  }

  async function saveDeliveryFee() {
    const raw = deliveryFeeEdit.trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || n < 0 || n > 1_000_000) {
      toast.error("Delivery fee must be a non-negative amount in PKR");
      return;
    }
    if (Math.round(n * 100) !== n * 100) {
      toast.error("Delivery fee can have at most 2 decimal places");
      return;
    }
    // Re-read the latest settings so other fields saved elsewhere are not overwritten.
    const latest = await fetch("/api/settings", { credentials: "same-origin" });
    if (!latest.ok) {
      toast.error("Could not load current settings");
      return;
    }
    const current = (await latest.json()) as ISettings;
    const r = await fetch("/api/settings", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...current, codCharges: n }),
    });
    if (!r.ok) {
      toast.error(
        r.status === 403
          ? "You don't have permission to change site settings"
          : "Update failed"
      );
      return;
    }
    const updated = (await r.json()) as ISettings;
    setSiteSettings(updated);
    setDeliveryFeeEdit(String(updated.codCharges ?? n));
    toast.success("Delivery fee updated");
  }

  if (loading && categories.length === 0) {
    return <PageSkeleton rows={3} />;
  }

  const giftCategories = categories.filter((c) => giftCategoryIds.includes(c.id));

  const categoryTable = (rows: Cat[], firstColumn: string) => (
    <div className="mt-4 overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-borderGray bg-lightGray">
          <tr>
            <th className="p-3">{firstColumn}</th>
            <th className="p-3">Commission Rate %</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
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
                  aria-label={`${c.categoryName} commission rate`}
                  value={edits[c.id] ?? ""}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                  className={inputClass}
                />
              </td>
              <td className="p-3">
                <LoadingButton loadingLabel="Saving…"
                  type="button"

                  onClick={() => saveCategory(c.id)}
                  className={saveButtonClass}
                >
                  Save
                </LoadingButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-bold text-darkText">Commission Settings</h1>
      <p className="mt-1 text-sm text-darkText/60">
        Configure commission rates for products, services, gifts and delivery.
      </p>

      <div className="mt-6 overflow-x-auto overflow-y-hidden border-b border-borderGray [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" aria-label="Commission type" className="flex min-w-max gap-1">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`commission-tab-${key}`}
                aria-selected={active}
                aria-controls={`commission-panel-${key}`}
                onClick={() => setTab(key)}
                className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "border-brand-hover bg-brand-soft text-brand-dark"
                    : "border-transparent text-darkText/60 hover:bg-lightGray hover:text-darkText"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`commission-panel-${tab}`}
        aria-labelledby={`commission-tab-${tab}`}
      >
        {tab === "products" && (
          <>
            <InfoNote>
              Category defaults apply to new orders. Vendor override wins over
              category and global.
            </InfoNote>

            <h2 className="mt-8 text-lg font-bold text-darkText">By category</h2>
            {categories.length === 0 ? (
              <EmptyState title="No product categories">
                Add active categories in Categories to configure their commission.
              </EmptyState>
            ) : (
              categoryTable(categories, "Category")
            )}

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
                            aria-label={`${v.shopName} override rate`}
                            value={vEdits[v.id] ?? ""}
                            onChange={(e) =>
                              setVEdits((prev) => ({
                                ...prev,
                                [v.id]: e.target.value,
                              }))
                            }
                            className={inputClass}
                          />
                        </td>
                        <td className="p-3">
                          <LoadingButton loadingLabel="Saving…"
                            type="button"

                            onClick={() => saveVendorCommission(v.id)}
                            className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-semibold text-brand-dark"
                          >
                            Save
                          </LoadingButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Kept mounted so unsaved range edits survive switching tabs. */}
        <div className={tab === "services" ? "" : "hidden"}>
          <ServiceCommissionRanges />
        </div>

        {tab === "gifts" && (
          <>
            <InfoNote>
              Gifts are regular products, so they use their product category&apos;s
              commission (and any vendor override). The categories below are the
              ones shown as gifts; their rates are shared with the Products tab.
              {giftTerms.length > 0 && (
                <>
                  {" "}Gift matching keywords: {giftTerms.join(", ")}. Gift products
                  in other categories use that category&apos;s rate.
                </>
              )}
            </InfoNote>
            {giftCategories.length === 0 ? (
              <EmptyState title="No gift categories">
                No product category name matches the gift keywords. Gift products
                are charged at the commission of the category they belong to.
              </EmptyState>
            ) : (
              categoryTable(giftCategories, "Category")
            )}
          </>
        )}

        {tab === "delivery" && (
          <>
            <InfoNote>
              Delivery charges are not part of vendor commission or vendor
              earnings calculations. Changing the fee affects new checkouts only.
            </InfoNote>

            {deliveryLoading && !siteSettings ? (
              <div className="mt-4">
                <PageSkeleton rows={2} />
              </div>
            ) : deliveryError ? (
              <div className="mt-4 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {deliveryError}{" "}
                <button
                  type="button"
                  onClick={() => void loadDelivery()}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-borderGray bg-lightGray">
                    <tr>
                      <th className="p-3">Setting</th>
                      <th className="p-3">Value</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-borderGray hover:bg-lightGray/40">
                      <td className="p-3">
                        <div className="font-medium">Delivery fee charged to customer</div>
                        <div className="text-xs text-darkText/60">
                          Flat fee added at checkout (COD charges). Quoted offers
                          use the shipping set in the vendor&apos;s quote instead.
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-darkText/60">PKR</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            aria-label="Delivery fee charged to customer (PKR)"
                            value={deliveryFeeEdit}
                            onKeyDown={blockNonDigitKeys}
                            onChange={(e) => setDeliveryFeeEdit(wholeNumber(e.target.value))}
                            className={inputClass}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <LoadingButton loadingLabel="Saving…"
                          type="button"
                          onClick={() => saveDeliveryFee()}
                          className={saveButtonClass}
                        >
                          Save
                        </LoadingButton>
                      </td>
                    </tr>
                    <tr className="border-b border-borderGray">
                      <td className="p-3">
                        <div className="font-medium">Delivery provider charges</div>
                        <div className="text-xs text-darkText/60">
                          Amount payable to a courier or delivery partner.
                        </div>
                      </td>
                      <td className="p-3 text-darkText/50" colSpan={2}>
                        Not supported yet: no delivery provider rates are configured
                        in the system.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        <div className="font-medium">Platform commission on delivery</div>
                        <div className="text-xs text-darkText/60">
                          Commission taken by JORO from delivery charges.
                        </div>
                      </td>
                      <td className="p-3 text-darkText/50" colSpan={2}>
                        Not supported yet: delivery charges are not subject to
                        commission.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
