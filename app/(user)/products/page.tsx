import { Suspense } from "react";
import { ProductsClient } from "./ProductsClient";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 text-darkText/60">Loading…</div>
      }
    >
      <ProductsClient />
    </Suspense>
  );
}
