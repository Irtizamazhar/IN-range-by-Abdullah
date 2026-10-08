import { Suspense } from "react";
import { ProductsClient } from "./ProductsClient";
import { ProductsLoading } from "./ProductsLoading";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={<ProductsLoading />}
    >
      <ProductsClient />
    </Suspense>
  );
}
