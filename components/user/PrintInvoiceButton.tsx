"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return (
    <LoadingButton
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-black text-brand-dark"
    >
      <Printer className="h-4 w-4" /> Print invoice
    </LoadingButton>
  );
}
