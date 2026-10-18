"use client";
import { Heart } from "lucide-react";
import { useSavedProducts } from "@/lib/use-saved-products";

export function SaveProductButton({ productId, name, variant = "pill", className = "" }: { productId: string; name: string; variant?: "pill" | "icon"; className?: string }) {
  const { ids, toggle, isSaving, loading } = useSavedProducts();
  const saved = ids.includes(productId);
  const label = saved ? `Remove ${name} from saved items` : `Save ${name}`;
  if (variant === "icon") return <button type="button" aria-pressed={saved} aria-label={label} disabled={loading || isSaving(productId)} onClick={() => void toggle(productId)} className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0B3D20] shadow-md transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0B3D20] disabled:opacity-60 ${className}`}><Heart aria-hidden="true" className={`h-5 w-5 ${saved ? "fill-current text-rose-600" : ""}`}/></button>;
  return <button type="button" aria-pressed={saved} aria-label={label} disabled={loading || isSaving(productId)} onClick={() => void toggle(productId)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-link transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link disabled:opacity-60"><Heart aria-hidden="true" className={`h-4 w-4 ${saved ? "fill-current text-rose-600" : ""}`}/>{saved ? "Saved" : "Save item"}</button>;
}
