import type { EditableWant, WantValues } from "@/components/user/WantForm";

/** The Want fields the edit form needs, as returned (JSON-serialised) by GET /api/wants/[id]. */
export type WantEditSource = {
  id: string; requestType: string; occasion: string | null; title: string; category: string; city: string; quantity: number;
  budgetMin: unknown; budgetMax: unknown; budgetFlexible: boolean; description: string | null; condition: string | null;
  needBy: string | Date | null; photo: string | null;
};

const CONDITIONS = ["Any", "New", "Used", "Refurbished"] as const;

export function wantToEditable(want: WantEditSource): EditableWant {
  const min = Number(want.budgetMin || 0), max = Number(want.budgetMax || 0);
  const values: Partial<WantValues> = {
    requestType: want.requestType === "SERVICE" || want.requestType === "GIFT" ? want.requestType : "PRODUCT",
    occasion: want.occasion || "", title: want.title, category: want.category, city: want.city, quantity: String(want.quantity),
    min: min > 0 ? String(min) : "", max: max > 0 ? String(max) : "",
    description: want.description || "", condition: CONDITIONS.find(c => c === want.condition) || "Any",
    needBy: want.needBy ? new Date(want.needBy).toISOString().slice(0, 10) : "", flexible: want.budgetFlexible,
  };
  return { id: want.id, values, photo: want.photo };
}
