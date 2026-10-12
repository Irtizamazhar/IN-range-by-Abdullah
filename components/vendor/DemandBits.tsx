import { Gift, Package, Wrench } from "lucide-react";

/** Display pieces shared by the vendor demand list and demand detail page. */
export const DEMAND_TYPES: Record<string, { label: string; text: string; Icon: typeof Package }> = {
  PRODUCT: { label: "Product", text: "text-emerald-700", Icon: Package },
  SERVICE: { label: "Service", text: "text-sky-700", Icon: Wrench },
  GIFT: { label: "Gift", text: "text-rose-600", Icon: Gift },
};
export const demandType = (requestType?: string | null) => DEMAND_TYPES[requestType || ""] || DEMAND_TYPES.PRODUCT;

const pkr = (value: number) => value.toLocaleString("en-PK", { maximumFractionDigits: 0 });
export function demandBudget(want: { budgetFlexible: boolean; budgetMin: unknown; budgetMax: unknown }) {
  const min = Number(want.budgetMin) || 0, max = Number(want.budgetMax) || 0;
  if (want.budgetFlexible || (!min && !max)) return "Flexible budget";
  if (!max || min === max) return `PKR ${pkr(max || min)}`;
  return min ? `PKR ${pkr(min)} – ${pkr(max)}` : `Up to PKR ${pkr(max)}`;
}

export function TypePill({ requestType, className = "" }: { requestType?: string | null; className?: string }) {
  const type = demandType(requestType);
  return <span className={`rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold shadow-sm ${type.text} ${className}`}>{type.label}</span>;
}

/** The match score is already 0–100; colour it by strength. */
export function MatchBadge({ score, className = "" }: { score: number; className?: string }) {
  const tone = score >= 70 ? "bg-emerald-800 text-white" : score >= 40 ? "bg-amber-500 text-white" : "bg-neutral-500 text-white";
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`}>{Math.round(score)}% match</span>;
}

export function ReasonChips({ reasons, max = Infinity }: { reasons: string[]; max?: number }) {
  if (!reasons.length) return null;
  const shown = reasons.slice(0, max), extra = reasons.length - shown.length;
  return <ul className="flex flex-wrap gap-1.5" aria-label="Why this matches your store">
    {shown.map(reason => <li key={reason} className="rounded-full bg-lime-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">{reason}</li>)}
    {extra > 0 && <li className="rounded-full bg-lime-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800" title={reasons.slice(max).join(", ")}>+{extra}</li>}
  </ul>;
}
