import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { VendorProductForm } from "@/components/vendor/VendorProductForm";

export const dynamic = "force-dynamic";

export default async function VendorNewProductPage() {
  const row = await getVendorFromSession();
  if (!row) {
    redirect("/vendor/login");
  }
  if (row.vendor.status !== "approved") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-neutral-700">
          Your shop must be approved before you can add products.
        </p>
        <Link
          href="/vendor/dashboard/products"
          className="mt-4 inline-block font-bold text-amber-700 underline"
        >
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <VendorProductForm mode="create" />
    </div>
  );
}
