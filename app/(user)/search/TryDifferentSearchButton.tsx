"use client";
import { Search } from "lucide-react";

/** Moves the visitor into the header search box (the site's one search field) with the current text selected. */
export function TryDifferentSearchButton({ className }: { className: string }) {
  function focusHeaderSearch() {
    const field = Array.from(document.querySelectorAll<HTMLInputElement>('input[aria-label="Search JORO marketplace"]'))
      .find((input) => input.getClientRects().length > 0);
    if (!field) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
    field.select();
  }
  return <button type="button" onClick={focusHeaderSearch} className={className}><Search className="h-5 w-5" aria-hidden="true" />Try a different search</button>;
}
