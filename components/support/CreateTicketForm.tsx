"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

type Resource = { id: string; label: string };

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  ORDER: "Order", WANT: "Want", WANT_OFFER: "Offer", SERVICE_BOOKING: "Service booking", RETURN_REQUEST: "Return / Refund",
  VENDOR_SHOP_ORDER: "Order", WITHDRAWAL: "Withdrawal", PRODUCT: "Product",
};

export function CreateTicketForm({
  apiBase, categories, resourceTypes, ticketsHref,
}: {
  apiBase: string;
  categories: readonly (readonly [string, string])[];
  resourceTypes: readonly string[];
  ticketsHref: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lockedType = searchParams?.get("resourceType") || "";
  const lockedId = searchParams?.get("resourceId") || "";
  const hasLockedResource = Boolean(lockedType && lockedId && resourceTypes.includes(lockedType));

  const [resourceType, setResourceType] = useState(hasLockedResource ? lockedType : "");
  const [resourceId, setResourceId] = useState(hasLockedResource ? lockedId : "");
  const [resourceLabel, setResourceLabel] = useState("");
  const [options, setOptions] = useState<Resource[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadOptions = useCallback(async (type: string) => {
    if (!type) { setOptions([]); return; }
    setLoadingOptions(true);
    try {
      const r = await fetch(`${apiBase}/resources?type=${encodeURIComponent(type)}`, { credentials: "same-origin" });
      const d = (await r.json()) as { resources?: Resource[] };
      const list = d.resources || [];
      setOptions(list);
      if (hasLockedResource) {
        const match = list.find(o => o.id === lockedId);
        if (match) setResourceLabel(match.label);
      }
    } catch { /* resource list is a convenience, not required */ }
    finally { setLoadingOptions(false); }
  }, [apiBase, hasLockedResource, lockedId]);

  useEffect(() => { if (resourceType) void loadOptions(resourceType); }, [resourceType, loadOptions]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (resourceType && resourceId) { fd.set("relatedResourceType", resourceType); fd.set("relatedResourceId", resourceId); }
      else { fd.delete("relatedResourceType"); fd.delete("relatedResourceId"); }
      const r = await fetch(`${apiBase}/tickets`, { method: "POST", body: fd, credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not create ticket");
      toast.success(`Ticket ${d.ticket.ticketNumber} created`);
      router.push(`${ticketsHref}/${d.ticket.id}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not create ticket"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={e => void submit(e)} className="joro-form mx-auto mt-6 grid max-w-2xl gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-black text-darkText">Create Support Ticket</h1>
      <p className="my-1 text-sm" role="status">{message}</p>

      <label>Category
        <select name="category" required defaultValue="">
          <option value="" disabled>Choose a category</option>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label>Subject<input name="subject" maxLength={200} minLength={3} required placeholder="Short summary of your issue" /></label>
      <label>Message<textarea name="message" maxLength={5000} minLength={3} rows={6} required placeholder="Describe what's happening" /></label>

      {hasLockedResource ? (
        <div className="rounded-xl border border-brand-primary/40 bg-brand-soft p-3 text-sm">
          <p className="font-bold text-darkText">Attached: {resourceLabel || `${RESOURCE_TYPE_LABELS[resourceType] || resourceType} reference`}</p>
          <button type="button" onClick={() => { setResourceType(""); setResourceId(""); }} className="mt-1 text-xs font-bold text-brand-link underline">Remove attachment</button>
        </div>
      ) : (
        <>
          <label>Related item (optional)
            <select value={resourceType} onChange={e => { setResourceType(e.target.value); setResourceId(""); }}>
              <option value="">None</option>
              {resourceTypes.map(t => <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t] || t}</option>)}
            </select>
          </label>
          {resourceType ? (
            <label>Choose {RESOURCE_TYPE_LABELS[resourceType] || resourceType}
              <select value={resourceId} onChange={e => setResourceId(e.target.value)} disabled={loadingOptions}>
                <option value="">{loadingOptions ? "Loading…" : "Select one"}</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          ) : null}
        </>
      )}

      <label>Attachment (optional — JPG, PNG, or WebP, max 5MB)<input type="file" name="attachment" accept="image/png,image/jpeg,image/webp" /></label>

      <button disabled={busy} className="rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark disabled:opacity-50">{busy ? "Creating…" : "Create Ticket"}</button>
    </form>
  );
}
