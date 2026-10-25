"use client";
import { blockNonDigitKeys, wholeNumber } from "@/lib/whole-number-input";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  MAX_SERVICE_COMMISSION_RANGES,
  validateServiceCommissionRanges,
  type RangeFieldErrors,
  type ServiceCommissionRangeInput,
} from "@/lib/service-commission-ranges";

type ServerRange = ServiceCommissionRangeInput & { id: string };
type Row = { key: string; minAmount: string; maxAmount: string; commissionPercentage: string; isActive: boolean };

const inputClass =
  "w-28 rounded-lg border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

let keySeq = 0;
const newKey = () => `row-${++keySeq}`;

function toRows(ranges: ServiceCommissionRangeInput[]): Row[] {
  return ranges.map((r) => ({
    key: newKey(),
    minAmount: String(r.minAmount),
    maxAmount: String(r.maxAmount),
    commissionPercentage: String(r.commissionPercentage),
    isActive: r.isActive,
  }));
}

const num = (value: string) => (value.trim() === "" ? NaN : Number(value));

function toInput(rows: Row[]): ServiceCommissionRangeInput[] {
  return rows.map((r) => ({
    minAmount: num(r.minAmount),
    maxAmount: num(r.maxAmount),
    commissionPercentage: num(r.commissionPercentage),
    isActive: r.isActive,
  }));
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 max-w-[14rem] text-xs text-red-600">{message}</p> : null;
}

/** Editable price-range commission table for service bookings. */
export function ServiceCommissionRanges() {
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState<string>("[]");
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [serverErrors, setServerErrors] = useState<RangeFieldErrors[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch("/api/admin/service-commission-ranges", { credentials: "same-origin" });
      if (!r.ok) throw new Error(r.status === 403 || r.status === 401 ? "You don't have permission to manage commission settings." : "Could not load service commission ranges.");
      const d = (await r.json()) as { ranges: ServerRange[]; version: string };
      const next = toRows(d.ranges);
      setRows(next);
      setSaved(JSON.stringify(toInput(next)));
      setVersion(d.version);
      setServerErrors(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load service commission ranges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const input = useMemo(() => toInput(rows), [rows]);
  const validation = useMemo(() => validateServiceCommissionRanges(input), [input]);
  const dirty = JSON.stringify(input) !== saved;

  function update(key: string, patch: Partial<Row>) {
    setServerErrors(null);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRange() {
    if (rows.length >= MAX_SERVICE_COMMISSION_RANGES) {
      toast.error(`At most ${MAX_SERVICE_COMMISSION_RANGES} ranges are allowed.`);
      return;
    }
    const highestMax = input.reduce((max, r) => (Number.isFinite(r.maxAmount) ? Math.max(max, r.maxAmount) : max), -1);
    setRows((prev) => [
      ...prev,
      { key: newKey(), minAmount: highestMax >= 0 ? String(Math.floor(highestMax) + 1) : "0", maxAmount: "", commissionPercentage: "", isActive: true },
    ]);
  }

  function removeRange(index: number) {
    const r = rows[index];
    if (!r) return;
    if (!window.confirm(`Delete range #${index + 1} (PKR ${r.minAmount || "?"}–${r.maxAmount || "?"})? This takes effect when you save.`)) return;
    setServerErrors(null);
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(body: Record<string, unknown>, successMessage: string) {
    const r = await fetch("/api/admin/service-commission-ranges", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, version }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string; rowErrors?: RangeFieldErrors[]; ranges?: ServerRange[]; version?: string; warnings?: string[] };
    if (!r.ok) {
      if (d.rowErrors) setServerErrors(d.rowErrors);
      toast.error(d.error || "Could not save commission ranges.");
      return;
    }
    const next = toRows(d.ranges || []);
    setRows(next);
    setSaved(JSON.stringify(toInput(next)));
    setVersion(d.version || "");
    setServerErrors(null);
    toast.success(successMessage);
    for (const w of d.warnings || []) toast(w, { icon: "⚠️" });
  }

  async function save() {
    if (!validation.valid) {
      toast.error("Fix the highlighted ranges before saving.");
      return;
    }
    await submit({ action: "save", ranges: input }, "Service commission ranges saved");
  }

  async function resetToDefault() {
    if (!window.confirm("Replace all service commission ranges with the default ranges? Existing bookings keep their saved commission.")) return;
    await submit({ action: "reset" }, "Service commission ranges reset to default");
  }

  if (loading && rows.length === 0 && !loadError) return <div className="mt-4"><PageSkeleton rows={3} /></div>;

  if (loadError) {
    return (
      <div className="mt-4 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {loadError}{" "}
        <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>
      </div>
    );
  }

  const rowErrors = serverErrors ?? validation.rowErrors;

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-darkText">Service Commission (Custom Ranges)</h2>
        </div>
        <button
          type="button"
          onClick={addRange}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-dark sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add Range
        </button>
      </div>

      {(validation.warnings.length > 0 || validation.errors.length > 0) && (
        <div className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {[...validation.errors, ...validation.warnings].map((w) => (
            <p key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{w}</p>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-borderGray bg-lightGray">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Service Amount Range (PKR)</th>
              <th className="p-3">Commission Rate (%)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-darkText/50">
                  No ranges configured — service bookings will be refused. Add a range or reset to default.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const e = rowErrors[i] ?? {};
                return (
                  <tr key={r.key} className={`border-b border-borderGray align-top hover:bg-lightGray/40 ${r.isActive ? "" : "opacity-60"}`}>
                    <td className="p-3 font-semibold">{i + 1}</td>
                    <td className="p-3">
                      <div className="flex items-start gap-2">
                        <div>
                          <input type="number" min={0} step={1} inputMode="numeric" aria-label={`Range ${i + 1} minimum amount`} aria-invalid={Boolean(e.minAmount)} value={r.minAmount} onKeyDown={blockNonDigitKeys} onChange={(ev) => update(r.key, { minAmount: wholeNumber(ev.target.value) })} className={`${inputClass} ${e.minAmount ? "border-red-400" : "border-borderGray"}`} />
                          <FieldError message={e.minAmount} />
                        </div>
                        <span className="pt-1 text-darkText/50">–</span>
                        <div>
                          <input type="number" min={0} step={1} inputMode="numeric" aria-label={`Range ${i + 1} maximum amount`} aria-invalid={Boolean(e.maxAmount)} value={r.maxAmount} onKeyDown={blockNonDigitKeys} onChange={(ev) => update(r.key, { maxAmount: wholeNumber(ev.target.value) })} className={`${inputClass} ${e.maxAmount ? "border-red-400" : "border-borderGray"}`} />
                          <FieldError message={e.maxAmount} />
                        </div>
                      </div>
                      <FieldError message={e.range} />
                    </td>
                    <td className="p-3">
                      <input type="number" min={0} max={100} step={0.01} inputMode="decimal" aria-label={`Range ${i + 1} commission rate`} aria-invalid={Boolean(e.commissionPercentage)} value={r.commissionPercentage} onChange={(ev) => update(r.key, { commissionPercentage: ev.target.value })} className={`${inputClass} w-20 ${e.commissionPercentage ? "border-red-400" : "border-borderGray"}`} />
                      <FieldError message={e.commissionPercentage} />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.isActive}
                        aria-label={`Range ${i + 1} ${r.isActive ? "active" : "inactive"}`}
                        onClick={() => update(r.key, { isActive: !r.isActive })}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${r.isActive ? "bg-brand-soft text-brand-dark" : "bg-lightGray text-darkText/60"}`}
                      >
                        {r.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-3">
                      <button type="button" onClick={() => removeRange(i)} aria-label={`Delete range ${i + 1}`} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <LoadingButton type="button" loadingLabel="Saving…" disabled={!dirty || !validation.valid} onClick={save} className="rounded-lg bg-primaryYellow px-5 py-2 text-sm font-semibold text-brand-dark disabled:opacity-50">
          Save Changes
        </LoadingButton>
        <LoadingButton type="button" loadingLabel="Resetting…" onClick={resetToDefault} className="inline-flex items-center gap-1.5 rounded-lg border border-borderGray bg-white px-4 py-2 text-sm font-semibold text-darkText">
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset to Default
        </LoadingButton>
        {dirty && (
          <>
            <button type="button" onClick={() => void load()} className="text-sm font-semibold text-darkText/60 underline">Discard changes</button>
            <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-darkText/50">
        Changes apply to new bookings only. Existing bookings keep the commission saved when they were placed.
      </p>
    </section>
  );
}
